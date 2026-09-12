// Self-contained Graph API publish calls for the worker - deliberately not
// shared with apps/web/lib/meta.ts (a different app in this monorepo);
// duplicating this small amount of fetch logic is simpler than wiring up a
// cross-app shared package for ~30 lines of code.

const GRAPH_API_VERSION = "v21.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

async function parseGraphResponse<T>(res: Response, context: string): Promise<T> {
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${context} failed (${res.status}): ${body}`);
  }
  return res.json() as Promise<T>;
}

export interface PublishToInstagramInput {
  pageAccessToken: string;
  igUserId: string;
  imageUrl: string;
  caption: string;
}

/** Instagram Content Publishing is a two-step Graph API flow: create a
 * media container, then publish it. */
export async function publishToInstagram(
  input: PublishToInstagramInput,
): Promise<string> {
  const createParams = new URLSearchParams({
    image_url: input.imageUrl,
    caption: input.caption,
    access_token: input.pageAccessToken,
  });
  const createRes = await fetch(
    `${GRAPH_API_BASE}/${input.igUserId}/media?${createParams}`,
    { method: "POST" },
  );
  const { id: creationId } = await parseGraphResponse<{ id: string }>(
    createRes,
    "Instagram media container creation",
  );

  const publishParams = new URLSearchParams({
    creation_id: creationId,
    access_token: input.pageAccessToken,
  });
  const publishRes = await fetch(
    `${GRAPH_API_BASE}/${input.igUserId}/media_publish?${publishParams}`,
    { method: "POST" },
  );
  const { id: postId } = await parseGraphResponse<{ id: string }>(
    publishRes,
    "Instagram media publish",
  );

  return postId;
}

export interface PublishToFacebookInput {
  pageAccessToken: string;
  pageId: string;
  imageUrl: string;
  caption: string;
}

export async function publishToFacebook(
  input: PublishToFacebookInput,
): Promise<string> {
  const params = new URLSearchParams({
    url: input.imageUrl,
    caption: input.caption,
    access_token: input.pageAccessToken,
  });
  const res = await fetch(`${GRAPH_API_BASE}/${input.pageId}/photos?${params}`, {
    method: "POST",
  });
  const { post_id, id } = await parseGraphResponse<{
    post_id?: string;
    id: string;
  }>(res, "Facebook page photo post");

  return post_id ?? id;
}
