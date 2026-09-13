// No `import "server-only"` here (unlike session.ts/storage.ts): this
// module is unit-tested directly, and that marker only works inside
// Next.js's own build (it relies on a "react-server" export condition
// Vitest doesn't resolve) - it throws unconditionally under plain Node/
// Vitest execution. Real protection is unnecessary anyway since this is
// only ever imported by Route Handlers under app/api/meta/**.

const GRAPH_API_VERSION = "v21.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

const META_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "instagram_basic",
  "instagram_content_publish",
  "business_management",
];

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is not set`);
  }
  return value;
}

export function getMetaOAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: requireEnv("META_APP_ID"),
    redirect_uri: redirectUri,
    state,
    response_type: "code",
    scope: META_SCOPES.join(","),
  });
  return `https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth?${params.toString()}`;
}

interface MetaTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

async function parseGraphResponse<T>(res: Response, context: string): Promise<T> {
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${context} failed (${res.status}): ${body}`);
  }
  return res.json() as Promise<T>;
}

export async function exchangeCodeForToken(
  code: string,
  redirectUri: string,
): Promise<string> {
  const params = new URLSearchParams({
    client_id: requireEnv("META_APP_ID"),
    client_secret: requireEnv("META_APP_SECRET"),
    redirect_uri: redirectUri,
    code,
  });
  const res = await fetch(`${GRAPH_API_BASE}/oauth/access_token?${params}`);
  const data = await parseGraphResponse<MetaTokenResponse>(
    res,
    "Meta token exchange",
  );
  return data.access_token;
}

export interface LongLivedToken {
  accessToken: string;
  expiresInSeconds?: number;
}

export async function exchangeForLongLivedToken(
  shortLivedToken: string,
): Promise<LongLivedToken> {
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: requireEnv("META_APP_ID"),
    client_secret: requireEnv("META_APP_SECRET"),
    fb_exchange_token: shortLivedToken,
  });
  const res = await fetch(`${GRAPH_API_BASE}/oauth/access_token?${params}`);
  const data = await parseGraphResponse<MetaTokenResponse>(
    res,
    "Meta long-lived token exchange",
  );
  return { accessToken: data.access_token, expiresInSeconds: data.expires_in };
}

export interface ManagedPage {
  id: string;
  name: string;
  accessToken: string;
  instagramBusinessAccount?: {
    id: string;
    username?: string;
    profilePictureUrl?: string;
  };
}

interface GraphPagesResponse {
  data: Array<{
    id: string;
    name: string;
    access_token: string;
    instagram_business_account?: {
      id: string;
      username?: string;
      profile_picture_url?: string;
    };
  }>;
}

/** Lists the Facebook Pages the authorizing user manages, with each Page's
 * linked Instagram Business/Creator account (if any). */
export async function getManagedPagesWithInstagram(
  userAccessToken: string,
): Promise<ManagedPage[]> {
  const params = new URLSearchParams({
    access_token: userAccessToken,
    fields:
      "id,name,access_token,instagram_business_account{id,username,profile_picture_url}",
  });
  const res = await fetch(`${GRAPH_API_BASE}/me/accounts?${params}`);
  const data = await parseGraphResponse<GraphPagesResponse>(
    res,
    "Listing Facebook Pages",
  );

  return data.data.map((page) => ({
    id: page.id,
    name: page.name,
    accessToken: page.access_token,
    instagramBusinessAccount: page.instagram_business_account
      ? {
          id: page.instagram_business_account.id,
          username: page.instagram_business_account.username,
          profilePictureUrl: page.instagram_business_account.profile_picture_url,
        }
      : undefined,
  }));
}

interface GraphSinglePageResponse {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: {
    id: string;
    username?: string;
    profile_picture_url?: string;
  };
}

/** Fetches one specific Page's access token and linked Instagram account -
 * used when a user administers multiple Pages and has picked one, so we
 * don't have to hold every Page's token around while they decide. */
export async function getPageById(
  userAccessToken: string,
  pageId: string,
): Promise<ManagedPage> {
  const params = new URLSearchParams({
    access_token: userAccessToken,
    fields:
      "id,name,access_token,instagram_business_account{id,username,profile_picture_url}",
  });
  const res = await fetch(`${GRAPH_API_BASE}/${pageId}?${params}`);
  const page = await parseGraphResponse<GraphSinglePageResponse>(
    res,
    "Fetching Facebook Page",
  );

  return {
    id: page.id,
    name: page.name,
    accessToken: page.access_token,
    instagramBusinessAccount: page.instagram_business_account
      ? {
          id: page.instagram_business_account.id,
          username: page.instagram_business_account.username,
          profilePictureUrl: page.instagram_business_account.profile_picture_url,
        }
      : undefined,
  };
}

/** Updates the caption on an already-published Facebook Page post.
 * Instagram has no equivalent - the Content Publishing API has no way to
 * edit a caption after publishing, so this only exists for Facebook. */
export async function updateFacebookPostCaption(
  pageAccessToken: string,
  postId: string,
  caption: string,
): Promise<void> {
  const params = new URLSearchParams({
    message: caption,
    access_token: pageAccessToken,
  });
  const res = await fetch(`${GRAPH_API_BASE}/${postId}?${params}`, {
    method: "POST",
  });
  await parseGraphResponse<{ success: boolean }>(res, "Updating Facebook post caption");
}
