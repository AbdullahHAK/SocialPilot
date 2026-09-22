import {
  claimContentJobForPublishing,
  claimContentPublicationForPublishing,
  decryptToken,
  listPublishCandidates,
  markContentPublicationFailed,
  markContentPublicationPublished,
  markContentPublicationStoryPublished,
  markSocialAccountExpired,
  recordContentPublicationExternalId,
  rollupContentJobStatus,
  type ContentJobWithAccounts,
  type ContentPublication,
} from "@socialpilot/db";
import {
  MetaAuthError,
  publishFacebookStory,
  publishInstagramStory,
  publishToFacebook,
  publishToInstagram,
  verifyGraphObjectExists,
} from "./graph-publish";

export const MAX_PUBLISH_ATTEMPTS = 5;
const PUBLISH_BATCH_SIZE = 20;

/** A condition retrying won't fix on its own - no connected account for
 * the platform, or no image to publish - so it's marked FAILED on the
 * first attempt instead of cycling through RETRYING for the usual
 * backoff ladder (up to ~30 minutes per attempt) with no chance of ever
 * succeeding. */
class PermanentPublishError extends Error {}

/** Escalating backoff (2, 4, 8, 16, capped at 30 minutes) compared against
 * a publication's own lastAttemptAt - keeps retries from hammering the
 * Graph API while still trying again reasonably soon after a transient
 * failure. */
function backoffMs(attempts: number): number {
  return Math.min(2 ** attempts, 30) * 60_000;
}

function buildCaption(caption: string | null, hashtags: string[]): string {
  const tags = hashtags.length > 0 ? `\n\n${hashtags.join(" ")}` : "";
  return `${caption ?? ""}${tags}`.trim();
}

/** Publishes the same image as a Story right after its feed post goes out,
 * per the client's request that every post also go out as a Story
 * automatically - best-effort, a Story failure never marks the platform's
 * main publication as failed. Idempotent via externalStoryId: a retry of
 * the main platform (e.g. after the main post published but the process
 * crashed before this ran) never re-publishes an already-published Story. */
async function publishStoryBestEffort(
  publication: ContentPublication,
  job: ContentJobWithAccounts,
  accountExternalId: string,
  accessToken: string,
): Promise<void> {
  if (!job.storyImageUrl || publication.externalStoryId) return;

  try {
    const externalStoryId =
      publication.platform === "INSTAGRAM"
        ? await publishInstagramStory({
            pageAccessToken: accessToken,
            accountId: accountExternalId,
            imageUrl: job.storyImageUrl,
          })
        : await publishFacebookStory({
            pageAccessToken: accessToken,
            accountId: accountExternalId,
            imageUrl: job.storyImageUrl,
          });

    await markContentPublicationStoryPublished(publication.id, externalStoryId);
    console.log(`Published Story for job ${job.id} -> ${publication.platform} (${externalStoryId})`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Publishing Story for job ${job.id} -> ${publication.platform} failed: ${message}`);
  }
}

// Businesses that never opened the publishing options keep the original
// behavior: a feed post plus a Story, caption included.
const DEFAULT_PUBLISH_OPTIONS = { publishMode: "POST_AND_STORY", includeCaption: true } as const;

/** "Story only" mode: the Story IS the publication, so unlike
 * publishStoryBestEffort a failure here must fail (and retry) the platform
 * rather than be swallowed - otherwise nothing would ever have gone out. */
async function publishStoryOnly(
  publication: ContentPublication,
  job: ContentJobWithAccounts,
  accountExternalId: string,
  accessToken: string,
): Promise<void> {
  if (!publication.externalStoryId) {
    if (!job.storyImageUrl) {
      throw new PermanentPublishError("Job has no Story image to publish");
    }
    const externalStoryId =
      publication.platform === "INSTAGRAM"
        ? await publishInstagramStory({
            pageAccessToken: accessToken,
            accountId: accountExternalId,
            imageUrl: job.storyImageUrl,
          })
        : await publishFacebookStory({
            pageAccessToken: accessToken,
            accountId: accountExternalId,
            imageUrl: job.storyImageUrl,
          });
    // Recorded before marking published so a crash in between can't lose
    // the proof this platform already published.
    await markContentPublicationStoryPublished(publication.id, externalStoryId);
  }

  await markContentPublicationPublished(publication.id, null);
  console.log(`Published Story-only job ${job.id} -> ${publication.platform}`);
}

/** Publishes one platform's ContentPublication, verifying the result
 * actually exists on Meta's side rather than just trusting the API call
 * didn't throw. If a prior attempt already recorded an externalPostId
 * (e.g. it crashed after a successful Graph call but before this method
 * returned), that id is verified FIRST and, if real, treated as already
 * published - never re-published, since Meta's publish endpoints have no
 * idempotency key of their own and a blind retry could create a genuine
 * duplicate live post. */
async function publishOnePlatform(
  publication: ContentPublication,
  job: ContentJobWithAccounts,
): Promise<void> {
  if (job.organization.status !== "ACTIVE") {
    throw new Error(`Organization is ${job.organization.status.toLowerCase()}`);
  }

  const account = job.organization.socialAccounts.find(
    (candidate) => candidate.provider === publication.platform,
  );
  if (!account) {
    // Deliberately still retryable (not permanent): the client's explicit
    // requirement is that a post scheduled while an account was connected
    // self-heals if the account gets reconnected before the retry ladder
    // (5 attempts, backoff up to 30 min) runs out - see "Instagram and
    // Facebook publish independently" below. The picker itself (and the
    // schedule actions server-side) now refuse to let a *new* post target
    // a platform with no connected account in the first place, so this
    // path is only reachable for a job scheduled before a disconnect.
    throw new Error(`No connected ${publication.platform} account`);
  }
  // Already known dead from a prior attempt on ANY post for this account -
  // fail fast instead of re-discovering the same 190 through a live Graph
  // call, so every other scheduled post on a broken connection stops
  // burning retry attempts the moment the first one finds out.
  if (account.status === "EXPIRED") {
    throw new MetaAuthError(`${publication.platform} account disconnected - reconnect required`);
  }
  if (!job.masterImageUrl) {
    throw new PermanentPublishError("Job has no master image to publish");
  }

  const accessToken = decryptToken(account.accessToken);
  const options = job.organization.publishingSchedule ?? DEFAULT_PUBLISH_OPTIONS;
  const wantsPost = options.publishMode !== "STORY_ONLY";
  const wantsStory = options.publishMode !== "POST_ONLY";

  try {
    if (!wantsPost) {
      await publishStoryOnly(publication, job, account.externalId, accessToken);
      return;
    }

    if (publication.externalPostId) {
      const alreadyPublished = await verifyGraphObjectExists(publication.externalPostId, accessToken);
      if (alreadyPublished) {
        await markContentPublicationPublished(publication.id, publication.externalPostId);
        if (wantsStory) {
          await publishStoryBestEffort(publication, job, account.externalId, accessToken);
        }
        return;
      }
      // The stored id never actually resolved to a live post - fall through
      // and publish fresh, same as if nothing had been recorded yet.
    }

    const caption = options.includeCaption ? buildCaption(job.caption, job.hashtags) : "";
    const externalPostId =
      publication.platform === "INSTAGRAM"
        ? await publishToInstagram({
            pageAccessToken: accessToken,
            igUserId: account.externalId,
            imageUrl: job.masterImageUrl,
            caption,
          })
        : await publishToFacebook({
            pageAccessToken: accessToken,
            pageId: account.externalId,
            imageUrl: job.masterImageUrl,
            caption,
          });

    // Persisted immediately, before verification or the Story sub-step, so a
    // crash right after this line still leaves durable proof that stops a
    // retry from ever calling the publish endpoint again for this platform.
    await recordContentPublicationExternalId(publication.id, externalPostId);

    const verified = await verifyGraphObjectExists(externalPostId, accessToken);
    if (!verified) {
      throw new Error(`Published ${publication.platform} post did not verify (${externalPostId})`);
    }

    await markContentPublicationPublished(publication.id, externalPostId);
    console.log(`Published job ${job.id} -> ${publication.platform} (${externalPostId})`);

    if (wantsStory) {
      await publishStoryBestEffort(publication, job, account.externalId, accessToken);
    }
  } catch (error) {
    if (error instanceof MetaAuthError) {
      await markSocialAccountExpired(account.id);
    }
    throw error;
  }
}

/**
 * Publishes every due platform independently: each ContentPublication is
 * claimed (CAS PENDING/RETRYING -> PUBLISHING) and attempted on its own,
 * so Instagram succeeding never blocks or gets touched again while only
 * Facebook retries, and two worker ticks/processes racing the same
 * publication can't both publish it - the loser's claim just returns
 * null. A publication past MAX_PUBLISH_ATTEMPTS or still within its own
 * backoff window is skipped for this tick.
 */
export async function runPublishCycle(now: Date = new Date()): Promise<void> {
  const candidates = await listPublishCandidates(now, PUBLISH_BATCH_SIZE);

  for (const { publication, job } of candidates) {
    if (publication.attempts >= MAX_PUBLISH_ATTEMPTS) continue;
    if (
      publication.lastAttemptAt &&
      now.getTime() - publication.lastAttemptAt.getTime() < backoffMs(publication.attempts)
    ) {
      continue;
    }

    // One candidate's unexpected failure (e.g. a database error while
    // recording a result) must not abort the rest of the batch.
    try {
      // Best-effort status flip for display - the actual publish gate is
      // the per-publication claim below, not this.
      await claimContentJobForPublishing(job.id);

      const claimedPublication = await claimContentPublicationForPublishing(publication.id, now);
      if (!claimedPublication) continue;

      try {
        await publishOnePlatform(claimedPublication, job);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Publishing job ${job.id} -> ${publication.platform} failed: ${message}`);
        await markContentPublicationFailed(claimedPublication.id, message, {
          // A dead connection - or one that was never there - won't fix
          // itself on the next attempt, no point burning the usual retry
          // ladder before giving up.
          permanent:
            error instanceof MetaAuthError ||
            error instanceof PermanentPublishError ||
            claimedPublication.attempts + 1 >= MAX_PUBLISH_ATTEMPTS,
        });
      }

      await rollupContentJobStatus(job.id);
    } catch (error) {
      console.error(
        `Publish cycle: handling job ${job.id} -> ${publication.platform} failed unexpectedly`,
        error,
      );
    }
  }
}
