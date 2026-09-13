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

interface MediaContainerStatus {
  status_code: "EXPIRED" | "ERROR" | "FINISHED" | "IN_PROGRESS" | "PUBLISHED";
}

/** A freshly-created media container isn't always instantly publishable -
 * Instagram processes the image server-side first. Publishing too early
 * fails with "Media ID is not available... please wait for a moment"
 * (error 9007/2207027), so poll the container's own status instead of
 * assuming it's ready right after creation. */
async function waitForContainerReady(
  creationId: string,
  accessToken: string,
  { pollIntervalMs = 1500, timeoutMs = 60_000 } = {},
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const params = new URLSearchParams({
      fields: "status_code",
      access_token: accessToken,
    });
    const res = await fetch(`${GRAPH_API_BASE}/${creationId}?${params}`);
    const { status_code } = await parseGraphResponse<MediaContainerStatus>(
      res,
      "Instagram media container status check",
    );

    if (status_code === "FINISHED" || status_code === "PUBLISHED") return;
    if (status_code === "ERROR" || status_code === "EXPIRED") {
      throw new Error(`Instagram media container failed to process (${status_code})`);
    }
    if (Date.now() >= deadline) {
      throw new Error("Instagram media container did not finish processing in time");
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
}

/** Instagram Content Publishing is a two-step Graph API flow: create a
 * media container, wait for it to finish processing, then publish it. */
export async function publishToInstagram(
  input: PublishToInstagramInput,
  pollOptions?: { pollIntervalMs?: number; timeoutMs?: number },
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

  await waitForContainerReady(creationId, input.pageAccessToken, pollOptions);

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

export interface PublishStoryInput {
  pageAccessToken: string;
  /** The IG Business account id for Instagram, the Page id for Facebook. */
  accountId: string;
  imageUrl: string;
}

/** Instagram Stories go through the same container flow as a feed post,
 * just with media_type=STORIES - and unlike a feed post, a Story
 * container takes no caption (the API has no field for it). */
export async function publishInstagramStory(
  input: PublishStoryInput,
  pollOptions?: { pollIntervalMs?: number; timeoutMs?: number },
): Promise<string> {
  const createParams = new URLSearchParams({
    image_url: input.imageUrl,
    media_type: "STORIES",
    access_token: input.pageAccessToken,
  });
  const createRes = await fetch(
    `${GRAPH_API_BASE}/${input.accountId}/media?${createParams}`,
    { method: "POST" },
  );
  const { id: creationId } = await parseGraphResponse<{ id: string }>(
    createRes,
    "Instagram Story container creation",
  );

  await waitForContainerReady(creationId, input.pageAccessToken, pollOptions);

  const publishParams = new URLSearchParams({
    creation_id: creationId,
    access_token: input.pageAccessToken,
  });
  const publishRes = await fetch(
    `${GRAPH_API_BASE}/${input.accountId}/media_publish?${publishParams}`,
    { method: "POST" },
  );
  const { id: storyId } = await parseGraphResponse<{ id: string }>(
    publishRes,
    "Instagram Story publish",
  );

  return storyId;
}

/** Facebook Page Stories are a separate two-step flow from a feed photo
 * post: upload the photo unpublished first, then turn that photo into a
 * Story. */
export async function publishFacebookStory(input: PublishStoryInput): Promise<string> {
  const uploadParams = new URLSearchParams({
    url: input.imageUrl,
    published: "false",
    access_token: input.pageAccessToken,
  });
  const uploadRes = await fetch(`${GRAPH_API_BASE}/${input.accountId}/photos?${uploadParams}`, {
    method: "POST",
  });
  const { id: photoId } = await parseGraphResponse<{ id: string }>(
    uploadRes,
    "Facebook Story photo upload",
  );

  const storyParams = new URLSearchParams({
    photo_id: photoId,
    access_token: input.pageAccessToken,
  });
  const storyRes = await fetch(`${GRAPH_API_BASE}/${input.accountId}/photo_stories?${storyParams}`, {
    method: "POST",
  });
  const { post_id, id } = await parseGraphResponse<{ post_id?: string; id: string }>(
    storyRes,
    "Facebook Story publish",
  );

  return post_id ?? id;
}
