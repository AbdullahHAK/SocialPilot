import { computeUpcomingSlotOccurrences, prisma, syncSlotDrivenContentJobs } from "@socialpilot/db";

// A full week: every slot always has its next occurrence materialized, and
// the schedule survives up to a week of worker downtime without losing
// track of what should happen. Cheap regardless of length - materializing
// only ever creates lightweight PENDING rows, never an AI image, so a
// longer window costs nothing but a few extra database rows.
const MATERIALIZE_LOOKAHEAD_DAYS = 7;

/**
 * Keeps every organization's upcoming recurring-slot occurrences
 * represented as PENDING ContentJobs (materialize), and removes/shrinks
 * any such job that no longer matches the organization's CURRENT live
 * schedule (reconcile) - e.g. a slot was deleted, disabled, or its time
 * changed after the job was first materialized but before it ever started
 * generating. This is what lets "the customer changes the schedule before
 * generation starts" cost nothing: nothing is ever generated for a
 * PENDING job, so removing/updating one here is always free.
 *
 * Deliberately does NOT call any AI generation, and deliberately does NOT
 * filter by brand/creative readiness - this cycle is purely mechanical
 * scheduling metadata, cheap enough to run for every org with a schedule
 * at all, regardless of current slot count. That matters for reconcile
 * specifically: an org whose last slot was just deleted has ZERO enabled
 * slots, but still needs this cycle to run for it once more so its
 * now-orphaned PENDING job gets removed - filtering such orgs out of the
 * query (as an earlier version of this cycle did) would leave that job
 * stuck forever, since reconciliation only happens as a side effect of
 * this same function running. A job materialized for an org whose brand
 * later turns out incomplete isn't wasted either - the generation cycle
 * re-checks that and cancels it instead of generating.
 */
export async function runMaterializeCycle(now: Date = new Date()): Promise<void> {
  const organizations = await prisma.organization.findMany({
    where: { publishingSchedule: { isNot: null } },
    include: {
      publishingSchedule: { include: { slots: { where: { enabled: true } } } },
    },
  });

  const windowEnd = new Date(now.getTime() + MATERIALIZE_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000);

  for (const org of organizations) {
    const slots = org.publishingSchedule?.slots ?? [];
    const occurrences =
      slots.length > 0
        ? computeUpcomingSlotOccurrences(slots, {
            from: now,
            days: MATERIALIZE_LOOKAHEAD_DAYS,
            timezone: org.publishingSchedule?.timezone ?? "UTC",
          })
        : [];

    try {
      await syncSlotDrivenContentJobs(
        org.id,
        occurrences.map((occurrence) => ({
          scheduledFor: occurrence.date,
          platform: occurrence.platform,
        })),
        now,
        windowEnd,
      );
    } catch (error) {
      console.error(`Materializing content jobs for org ${org.id} failed`, error);
    }
  }
}
