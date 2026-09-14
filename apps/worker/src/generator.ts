import {
  cancelStaleContentJobs,
  claimContentJobForGeneration,
  getBrandCreativeProfile,
  getBrandProfile,
  getSubscription,
  isSubscriptionActive,
  listGenerationCandidates,
  markContentJobCancelled,
  markContentJobGenerationFailed,
  type ContentJob,
} from "@socialpilot/db";
import { generateContentForJob, isBrandSetupComplete } from "@socialpilot/content-engine";

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

/** Re-checks everything that could have changed since this job was
 * materialized: the org's subscription must still be active, and its
 * brand/creative setup must still be complete (a business could delete
 * its logo, or the slot that produced this job could have been removed
 * out from under it in a narrow window between materialize cycles). */
async function verifyStillEligible(job: ContentJob): Promise<{ ok: true } | { ok: false; reason: string }> {
  const [subscription, brandProfile, creativeProfile] = await Promise.all([
    getSubscription(job.organizationId),
    getBrandProfile(job.organizationId),
    getBrandCreativeProfile(job.organizationId),
  ]);

  if (!isSubscriptionActive(subscription)) {
    return { ok: false, reason: "Subscription is no longer active" };
  }
  if (!isBrandSetupComplete(brandProfile, creativeProfile)) {
    return { ok: false, reason: "Brand setup is no longer complete" };
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
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Generating content job ${claimed.id} failed: ${message}`);
      await markContentJobGenerationFailed(claimed.id, message, MAX_GENERATION_ATTEMPTS);
    }
  }
}
