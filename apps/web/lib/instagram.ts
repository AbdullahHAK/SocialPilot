// "Instagram API with Instagram Login" - a separate Meta product from
// Facebook Login (lib/meta.ts), for the case Facebook Login can never
// serve: an Instagram Professional account with no linked Facebook Page.
// Confirmed against Meta's own docs - this path authenticates directly
// against api.instagram.com/graph.instagram.com, needs its own App
// ID/secret (a distinct product in the Meta App Dashboard, not reused from
// the Facebook Login app), and has no concept of "Pages" at all: the
// authenticated Instagram account IS the target, so there's no
// multi-account picker step the way Facebook Login needs one for someone
// managing several Pages.
//
// No `import "server-only"` - same reasoning as meta.ts, this is
// unit-tested directly and only ever imported from Route Handlers under
// app/api/instagram/**.

const IG_OAUTH_BASE = "https://api.instagram.com";
const GRAPH_API_VERSION = "v21.0";
const IG_GRAPH_API_BASE = `https://graph.instagram.com/${GRAPH_API_VERSION}`;

// Read access to the account's own identity, plus permission to publish
// media - the minimum needed for this app's daily-post pipeline.
const INSTAGRAM_SCOPES = ["instagram_business_basic", "instagram_business_content_publish"];

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is not set`);
  }
  return value;
}

export function getInstagramOAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: requireEnv("INSTAGRAM_APP_ID"),
    redirect_uri: redirectUri,
    scope: INSTAGRAM_SCOPES.join(","),
    response_type: "code",
    state,
  });
  return `${IG_OAUTH_BASE}/oauth/authorize?${params.toString()}`;
}

interface InstagramTokenResponse {
  access_token: string;
  user_id?: string;
}

async function parseInstagramResponse<T>(res: Response, context: string): Promise<T> {
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${context} failed (${res.status}): ${body}`);
  }
  return res.json() as Promise<T>;
}

/** Unlike Facebook's code exchange (a GET with query params), Instagram's
 * short-lived token exchange is a form-encoded POST - confirmed against
 * Meta's documented flow for this specific product. */
export async function exchangeCodeForToken(
  code: string,
  redirectUri: string,
): Promise<string> {
  const body = new URLSearchParams({
    client_id: requireEnv("INSTAGRAM_APP_ID"),
    client_secret: requireEnv("INSTAGRAM_APP_SECRET"),
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    code,
  });
  const res = await fetch(`${IG_OAUTH_BASE}/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await parseInstagramResponse<InstagramTokenResponse>(
    res,
    "Instagram token exchange",
  );
  return data.access_token;
}

export interface LongLivedInstagramToken {
  accessToken: string;
  expiresInSeconds?: number;
}

export async function exchangeForLongLivedToken(
  shortLivedToken: string,
): Promise<LongLivedInstagramToken> {
  const params = new URLSearchParams({
    grant_type: "ig_exchange_token",
    client_secret: requireEnv("INSTAGRAM_APP_SECRET"),
    access_token: shortLivedToken,
  });
  const res = await fetch(`${IG_GRAPH_API_BASE.replace(`/${GRAPH_API_VERSION}`, "")}/access_token?${params}`);
  const data = await parseInstagramResponse<{ access_token: string; expires_in?: number }>(
    res,
    "Instagram long-lived token exchange",
  );
  return { accessToken: data.access_token, expiresInSeconds: data.expires_in };
}

export interface InstagramAccountInfo {
  id: string;
  username: string;
  profilePictureUrl?: string;
}

/** There's no "list of Pages" step here the way Facebook Login has one -
 * the authenticated Instagram account itself is the only thing this token
 * can ever act as, so this just reads that account's own identity. */
export async function getInstagramAccountInfo(
  accessToken: string,
): Promise<InstagramAccountInfo> {
  const params = new URLSearchParams({
    fields: "id,username,profile_picture_url",
    access_token: accessToken,
  });
  const res = await fetch(`${IG_GRAPH_API_BASE}/me?${params}`);
  const data = await parseInstagramResponse<{
    id: string;
    username: string;
    profile_picture_url?: string;
  }>(res, "Fetching Instagram account info");

  return {
    id: data.id,
    username: data.username,
    profilePictureUrl: data.profile_picture_url,
  };
}
