import {
  cancelStaleContentJobs,
  claimContentJobForGeneration,
  getBrandCreativeProfile,
  getBrandProfile,
  getOrganizationStatus,
  getSubscription,
  isSubscriptionActive,
  listGenerationCandidates,
  listSocialAccounts,
  markContentJobCancelled,
  markContentJobGenerationFailed,
  releaseStuckGeneratingJobs,
  type ContentJob,
} from "@socialpilot/db";
import {
  generateContentForJob,
  isBrandSetupComplete,
  MonthlyImageCapReachedError,
} from "@socialpilot/content-engine";

// The client's explicit requirement: generate the creative ~5 minutes
// before the scheduled publish time, never days or hours ahead - late
// enough that a schedule change, a paused account, or a cancelled
// subscription right up until the last few minutes never wastes an image.
export const GENERATION_LEAD_MINUTES = 5;
// A job whose scheduledFor is further in the past than this was never
// generated in time (e.g. extended worker downtime) - cancel it instead
// of generating for a time that's already long gone.
export const GENERATION_STALE_CUTOFF_HOURS = 24;
export const MAX_GENERATION_ATTEMPTS = 3;
// A generation takes seconds to a couple of minutes, so a job still
// GENERATING after this long was abandoned (crash, deploy restart, ...).
export const STUCK_GENERATION_MINUTES = 15;
// An abandoned job is retried only if its slot is at most this late -
// beyond that it is cancelled, never published hours after its time.
export const STUCK_RECOVERY_MAX_LATE_MINUTES = 60;
const GENERATION_BATCH_SIZE = 10;

/** Re-checks everything that could have changed since this job was
 * materialized: the org must not be admin-suspended/blocked, must currently
 * have an active (and unexpired) subscription, and its brand/creative
 * setup must still be complete (a business could delete its logo, or the
 * slot that produced this job could have been removed out from under it in
 * a narrow window between materialize cycles).
 *
 * This used to allow every subscription state except CANCELED/PAUSED,
 * because at the time no real customer had ever been run through Stripe or
 * the (not-yet-built) manual activation flow - requiring an ACTIVE row
 * would have cancelled every paying customer's content. That's no longer
 * true: the admin panel's manual activation and activation-code redemption
 * now give every real activated customer a proper ACTIVE Subscription row
 * with a real currentPeriodEnd (confirmed against production data before
 * this change - every currently-active real account already has one).
 * The client's explicit, urgent request is that an account without one
 * must not generate or publish under any circumstances. */
async function verifyStillEligible(job: ContentJob): Promise<{ ok: true } | { ok: false; reason: string }> {
  const [orgStatus, subscription, brandProfile, creativeProfile, socialAccounts] = await Promise.all([
    getOrganizationStatus(job.organizationId),
    getSubscription(job.organizationId),
    getBrandProfile(job.organizationId),
    getBrandCreativeProfile(job.organizationId),
    listSocialAccounts(job.organizationId),
  ]);

  if (orgStatus && orgStatus !== "ACTIVE") {
    return { ok: false, reason: `Organization is ${orgStatus.toLowerCase()}` };
  }
  if (!isSubscriptionActive(subscription)) {
    return { ok: false, reason: "No active subscription" };
  }
  if (!isBrandSetupComplete(brandProfile, creativeProfile)) {
    return { ok: false, reason: "Brand setup is no longer complete" };
  }
  // Generating a caption+image just to fail publishing every single
  // platform (e.g. the account was disconnected after this job was
  // scheduled) wastes an image-generation call for content that can never
  // go anywhere - skip it if none of the job's platforms are connected.
  const connected = new Set(
    socialAccounts.filter((account) => account.status === "ACTIVE").map((account) => account.provider),
  );
  if (!job.platforms.some((platform) => connected.has(platform))) {
    return { ok: false, reason: "No connected account for any of this post's platforms" };
  }
  return { ok: true };
}

/**
 * Claims and generates every job due to start generating - scheduledFor
 * within GENERATION_LEAD_MINUTES of now. Each job is claimed via an
 * atomic compare-and-swap update before any work starts, so if two worker
 * ticks (or two worker processes) both consider the same job, only one
 * actually generates it - the loser's claim simply returns null and it
 * moves on, exactly the race-condition protection the client asked for.
 */
export async function runGenerationCycle(now: Date = new Date()): Promise<void> {
  // First, free any job a crashed or restarted worker left claimed - a
  // stranded GENERATING job is otherwise never touched again. Never allowed
  // to block this cycle's real work.
  try {
    const released = await releaseStuckGeneratingJobs(now, {
      stuckAfterMinutes: STUCK_GENERATION_MINUTES,
      maxLateMinutes: STUCK_RECOVERY_MAX_LATE_MINUTES,
      maxAttempts: MAX_GENERATION_ATTEMPTS,
    });
    if (released.retried + released.failed + released.cancelled > 0) {
      console.warn(
        `Released stuck generating jobs: ${released.retried} retried, ${released.failed} failed, ${released.cancelled} cancelled`,
      );
    }
  } catch (error) {
    console.error("Releasing stuck generating jobs failed", error);
  }

  await cancelStaleContentJobs(now, GENERATION_STALE_CUTOFF_HOURS);

  const candidates = await listGenerationCandidates(now, {
    leadMinutes: GENERATION_LEAD_MINUTES,
    staleCutoffHours: GENERATION_STALE_CUTOFF_HOURS,
    limit: GENERATION_BATCH_SIZE,
  });

  for (const candidate of candidates) {
    const claimed = await claimContentJobForGeneration(candidate.id, now);
    if (!claimed) continue; // another tick/process already won this job

    // Everything after the claim is inside this try: the eligibility check
    // used to sit outside it, so any error there (a database hiccup, a
    // schema mismatch) left the job stranded in GENERATING and aborted the
    // whole cycle for every job queued behind it.
    try {
      const eligible = await verifyStillEligible(claimed);
      if (!eligible.ok) {
        await markContentJobCancelled(claimed.id, eligible.reason);
        continue;
      }

      await generateContentForJob(claimed);
      console.log(`Generated content job ${claimed.id} for org ${claimed.organizationId}`);
    } catch (error) {
      await recordGenerationFailure(claimed.id, error);
    }
  }
}

/** Files a failed attempt against the job (retry ladder, or cancelled for a
 * month-long cap). Never throws: if even recording the failure fails (e.g.
 * the database is unreachable), the rest of the cycle must still run, and
 * the stuck-job sweep at the top of a later cycle releases this job. */
async function recordGenerationFailure(jobId: string, error: unknown): Promise<void> {
  try {
    if (error instanceof MonthlyImageCapReachedError) {
      // Won't lift again until next month - retrying on the usual 60s
      // cadence would just waste attempts, so cancel outright instead of
      // the normal retry path.
      await markContentJobCancelled(jobId, error.message);
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Generating content job ${jobId} failed: ${message}`);
    await markContentJobGenerationFailed(jobId, message, MAX_GENERATION_ATTEMPTS);
  } catch (recordError) {
    console.error(`Could not record the failure of content job ${jobId}`, recordError);
  }
}
