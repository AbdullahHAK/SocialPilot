import {
  decryptToken,
  listDuePosts,
  markContentPostFailed,
  markContentPostPublished,
  recordPublishedStory,
} from "@socialpilot/db";
import {
  publishFacebookStory,
  publishInstagramStory,
  publishToFacebook,
  publishToInstagram,
} from "./graph-publish";

function buildCaption(caption: string | null, hashtags: string[]): string {
  const tags = hashtags.length > 0 ? `\n\n${hashtags.join(" ")}` : "";
  return `${caption ?? ""}${tags}`.trim();
}

/** Publishes the same image as a Story right after its feed post goes
 * out, per the client's request that every post also go out as a Story
 * automatically. Best-effort: the feed post is the primary deliverable
 * and has already succeeded by the time this runs, so a Story failure is
 * just logged, never allowed to mark the whole post as failed. */
async function publishStoryBestEffort(
  post: { id: string; organizationId: string; platform: "INSTAGRAM" | "FACEBOOK"; caption: string | null; hashtags: string[]; storyImageUrl: string | null },
  accountExternalId: string,
  accessToken: string,
): Promise<void> {
  if (!post.storyImageUrl) return;

  try {
    const externalStoryId =
      post.platform === "INSTAGRAM"
        ? await publishInstagramStory({
            pageAccessToken: accessToken,
            accountId: accountExternalId,
            imageUrl: post.storyImageUrl,
          })
        : await publishFacebookStory({
            pageAccessToken: accessToken,
            accountId: accountExternalId,
            imageUrl: post.storyImageUrl,
          });

    await recordPublishedStory({
      organizationId: post.organizationId,
      platform: post.platform,
      caption: post.caption ?? undefined,
      hashtags: post.hashtags,
      imageUrls: [post.storyImageUrl],
      externalPostId: externalStoryId,
    });
    console.log(`Published Story for post ${post.id} -> ${post.platform} (${externalStoryId})`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Publishing Story for post ${post.id} failed: ${message}`);
  }
}

/**
 * Publishes every SCHEDULED post whose time has come, using the org's
 * connected social account for that post's platform. One post failing
 * (missing account, expired token, Graph API error) doesn't block the rest.
 */
export async function runPublishCycle(now: Date = new Date()): Promise<void> {
  const duePosts = await listDuePosts(now);

  for (const post of duePosts) {
    try {
      const account = post.organization.socialAccounts.find(
        (candidate) => candidate.provider === post.platform,
      );
      if (!account) {
        throw new Error(`No connected ${post.platform} account`);
      }

      const imageUrl = post.imageUrls[0];
      if (!imageUrl) {
        throw new Error("Post has no image to publish");
      }

      const accessToken = decryptToken(account.accessToken);
      const caption = buildCaption(post.caption, post.hashtags);

      const externalPostId =
        post.platform === "INSTAGRAM"
          ? await publishToInstagram({
              pageAccessToken: accessToken,
              igUserId: account.externalId,
              imageUrl,
              caption,
            })
          : await publishToFacebook({
              pageAccessToken: accessToken,
              pageId: account.externalId,
              imageUrl,
              caption,
            });

      await markContentPostPublished(post.id, externalPostId);
      console.log(`Published post ${post.id} -> ${post.platform} (${externalPostId})`);

      await publishStoryBestEffort(post, account.externalId, accessToken);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Publishing post ${post.id} failed: ${message}`);
      await markContentPostFailed(post.id, message);
    }
  }
}
