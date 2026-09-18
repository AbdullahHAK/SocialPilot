import {
  cancelStaleContentJobs,
  claimContentJobForGeneration,
  getBrandCreativeProfile,
  getBrandProfile,
  getOrganizationStatus,
  getSubscription,
  listGenerationCandidates,
  listSocialAccounts,
  markContentJobCancelled,
  markContentJobGenerationFailed,
  type ContentJob,
  type SubscriptionStatus,
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
const GENERATION_BATCH_SIZE = 10;

// Billing enforcement isn't actually wired up anywhere else in this
// product yet (apps/web/app/dashboard/subscription/page.tsx only ever
// *displays* isSubscriptionActive - nothing gates on it) - confirmed live
// in production, every real account (including the paying client's) has
// no Subscription row at all, since they were never run through Stripe
// checkout. Blocking generation on "no ACTIVE/TRIALING row" therefore
// cancelled every real customer's scheduled content the first time this
// shipped. CANCELED is the one unambiguous "this customer is gone"
// signal the client's spec actually needs guarded against; treat every
// other state - no row, INCOMPLETE (Stripe checkout never finished),
// PAST_DUE (a grace period, not a cancellation), TRIALING, ACTIVE - as
// still eligible, so this stays consistent with how the rest of the app
// already treats subscription status until real billing enforcement
// exists. PAUSED is an admin-only manual state added alongside CANCELED -
// its whole point is stopping generation, unlike the other passive states.
function isEligibleToGenerate(subscription: { status: SubscriptionStatus } | null): boolean {
  return subscription?.status !== "CANCELED" && subscription?.status !== "PAUSED";
}

/** Re-checks everything that could have changed since this job was
 * materialized: the org must not be admin-suspended/blocked, must not have
 * explicitly cancelled or paused its subscription, and its brand/creative
 * setup must still be complete (a business could delete its logo, or the
 * slot that produced this job could have been removed out from under it in
 * a narrow window between materialize cycles). */
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
  if (!isEligibleToGenerate(subscription)) {
    return { ok: false, reason: "Subscription was cancelled" };
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
  await cancelStaleContentJobs(now, GENERATION_STALE_CUTOFF_HOURS);

  const candidates = await listGenerationCandidates(now, {
    leadMinutes: GENERATION_LEAD_MINUTES,
    staleCutoffHours: GENERATION_STALE_CUTOFF_HOURS,
    limit: GENERATION_BATCH_SIZE,
  });

  for (const candidate of candidates) {
    const claimed = await claimContentJobForGeneration(candidate.id, now);
    if (!claimed) continue; // another tick/process already won this job

    const eligible = await verifyStillEligible(claimed);
    if (!eligible.ok) {
      await markContentJobCancelled(claimed.id, eligible.reason);
      continue;
    }

    try {
      await generateContentForJob(claimed);
      console.log(`Generated content job ${claimed.id} for org ${claimed.organizationId}`);
    } catch (error) {
      if (error instanceof MonthlyImageCapReachedError) {
        // Won't lift again until next month - retrying on the usual 60s
        // cadence would just waste attempts, so cancel outright instead
        // of the normal retry path.
        await markContentJobCancelled(claimed.id, error.message);
        continue;
      }
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Generating content job ${claimed.id} failed: ${message}`);
      await markContentJobGenerationFailed(claimed.id, message, MAX_GENERATION_ATTEMPTS);
    }
  }
}
