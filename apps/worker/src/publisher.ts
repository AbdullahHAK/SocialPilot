import {
  decryptToken,
  listDuePosts,
  markContentPostFailed,
  markContentPostPublished,
} from "@socialpilot/db";
import { publishToFacebook, publishToInstagram } from "./graph-publish";

function buildCaption(caption: string | null, hashtags: string[]): string {
  const tags = hashtags.length > 0 ? `\n\n${hashtags.join(" ")}` : "";
  return `${caption ?? ""}${tags}`.trim();
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
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Publishing post ${post.id} failed: ${message}`);
      await markContentPostFailed(post.id, message);
    }
  }
}
