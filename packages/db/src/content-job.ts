import {
  Prisma,
  type ContentJob,
  type ContentJobOrigin,
  type ContentJobStatus,
  type ContentPublication,
  type Platform,
} from "@prisma/client";
import { prisma } from "./index";

// Either the module-level client or a transaction client (from
// withDayImageLock) - lets findMasterImageForDay run either standalone or
// inside the locked transaction that makes the day-image
// check-then-generate sequence atomic, same pattern as content-post.ts.
type Db = Pick<typeof prisma, "contentJob">;

export interface MaterializeContentJobInput {
  organizationId: string;
  scheduledFor: Date;
  platforms: Platform[];
  origin: ContentJobOrigin;
}

/**
 * Creates the ContentJob (+ one ContentPublication per platform) for a
 * scheduled time if none exists yet, or - if one already does - adds any
 * platforms not yet represented on it. This merge-on-conflict behavior,
 * backed by the `@@unique([organizationId, scheduledFor])` constraint, is
 * what makes "no duplicate jobs for the same scheduled time" hold even
 * when two separate ScheduleSlot rows (e.g. Monday-18:00-Instagram and
 * Monday-18:00-Facebook) land on the exact same instant, or when a
 * one-time post is added for a time a recurring slot already materialized.
 * Adding a platform to a job that's already past PENDING is allowed (not
 * just for freshly-created jobs) - the new platform's ContentPublication
 * simply starts PENDING and gets published once the job's shared creative
 * is READY, same as any other platform on it.
 */
export async function materializeContentJob(
  input: MaterializeContentJobInput,
): Promise<ContentJob> {
  const existing = await prisma.contentJob.findUnique({
    where: {
      organizationId_scheduledFor: {
        organizationId: input.organizationId,
        scheduledFor: input.scheduledFor,
      },
    },
    include: { publications: true },
  });

  if (!existing) {
    return prisma.contentJob.create({
      data: {
        organizationId: input.organizationId,
        scheduledFor: input.scheduledFor,
        platforms: input.platforms,
        origin: input.origin,
        publications: { create: input.platforms.map((platform) => ({ platform })) },
      },
    });
  }

  const missing = input.platforms.filter(
    (platform) => !existing.publications.some((pub) => pub.platform === platform),
  );
  if (missing.length === 0) return existing;

  const mergedPlatforms = [...new Set([...existing.platforms, ...missing])];
  await prisma.$transaction([
    prisma.contentPublication.createMany({
      data: missing.map((platform) => ({ contentJobId: existing.id, platform })),
    }),
    prisma.contentJob.update({
      where: { id: existing.id },
      data: { platforms: mergedPlatforms },
    }),
  ]);
  return prisma.contentJob.findUniqueOrThrow({ where: { id: existing.id } });
}

export interface DesiredOccurrence {
  scheduledFor: Date;
  platform: Platform;
}

/**
 * Reconciles an organization's recurring-slot-driven ContentJobs against
 * the CURRENT live ScheduleSlot state: materializes a job for every
 * desired occurrence (merging platforms onto an existing job at the same
 * instant, per materializeContentJob), then deletes or shrinks any
 * `origin: SLOT`, `status: PENDING` job in the window that no longer
 * matches (a slot was deleted, disabled, or its time changed). This is
 * what satisfies "if the customer changes the schedule before generation
 * starts, cancel/update the old job, no wasted image" - reconciliation
 * only ever touches jobs that haven't started generating yet, and never
 * touches `origin: ONE_TIME` jobs (a customer's explicit one-time post is
 * never auto-cancelled by a change elsewhere in the recurring schedule).
 */
export async function syncSlotDrivenContentJobs(
  organizationId: string,
  occurrences: DesiredOccurrence[],
  windowStart: Date,
  windowEnd: Date,
): Promise<void> {
  const byInstant = new Map<number, Set<Platform>>();
  for (const occurrence of occurrences) {
    const key = occurrence.scheduledFor.getTime();
    const set = byInstant.get(key) ?? new Set<Platform>();
    set.add(occurrence.platform);
    byInstant.set(key, set);
  }

  for (const [time, platforms] of byInstant) {
    await materializeContentJob({
      organizationId,
      scheduledFor: new Date(time),
      platforms: [...platforms],
      origin: "SLOT",
    });
  }

  const existingPendingSlotJobs = await prisma.contentJob.findMany({
    where: {
      organizationId,
      origin: "SLOT",
      status: "PENDING",
      scheduledFor: { gte: windowStart, lt: windowEnd },
    },
  });

  for (const job of existingPendingSlotJobs) {
    const desired = byInstant.get(job.scheduledFor.getTime());
    if (!desired) {
      await prisma.contentJob.delete({ where: { id: job.id } });
      continue;
    }

    const remaining = job.platforms.filter((platform) => desired.has(platform));
    if (remaining.length === job.platforms.length) continue; // nothing dropped
    if (remaining.length === 0) {
      await prisma.contentJob.delete({ where: { id: job.id } });
      continue;
    }

    const toRemove = job.platforms.filter((platform) => !desired.has(platform));
    await prisma.$transaction([
      prisma.contentPublication.deleteMany({
        where: { contentJobId: job.id, platform: { in: toRemove } },
      }),
      prisma.contentJob.update({ where: { id: job.id }, data: { platforms: remaining } }),
    ]);
  }
}

/**
 * Claims a job for generation via an atomic compare-and-swap UPDATE
 * (PENDING/RETRYING -> GENERATING) - a fast, single-statement claim with
 * no transaction held across the slow OpenAI call that follows. Returns
 * null if another worker tick already won the claim (the row no longer
 * matched the WHERE clause by the time this ran), which the caller should
 * treat as "someone else has it, move on" rather than an error.
 */
export async function claimContentJobForGeneration(
  jobId: string,
  now: Date = new Date(),
): Promise<ContentJob | null> {
  const result = await prisma.contentJob.updateMany({
    where: { id: jobId, status: { in: ["PENDING", "RETRYING"] } },
    data: { status: "GENERATING", lastAttemptAt: now },
  });
  if (result.count === 0) return null;
  return prisma.contentJob.findUnique({ where: { id: jobId } });
}

/** Same CAS pattern as claimContentJobForGeneration, at the publish stage
 * (READY/RETRYING -> PUBLISHING) - claimed once per due job, independent
 * of each platform's own ContentPublication claim below. */
export async function claimContentJobForPublishing(jobId: string): Promise<ContentJob | null> {
  const result = await prisma.contentJob.updateMany({
    where: { id: jobId, status: { in: ["READY", "RETRYING"] } },
    data: { status: "PUBLISHING" },
  });
  if (result.count === 0) return null;
  return prisma.contentJob.findUnique({ where: { id: jobId } });
}

/** The per-platform equivalent of claimContentJobForPublishing - each
 * platform's ContentPublication is claimed independently, so Instagram and
 * Facebook (or a retry of just one of them) never block or affect each
 * other. This is what lets "Instagram published, only retry Facebook" hold
 * even when both are processed in the same worker tick. */
export async function claimContentPublicationForPublishing(
  publicationId: string,
  now: Date = new Date(),
): Promise<ContentPublication | null> {
  const result = await prisma.contentPublication.updateMany({
    where: { id: publicationId, status: { in: ["PENDING", "RETRYING"] } },
    data: { status: "PUBLISHING", lastAttemptAt: now },
  });
  if (result.count === 0) return null;
  return prisma.contentPublication.findUnique({ where: { id: publicationId } });
}

/** Jobs due to start generating - scheduledFor within `leadMinutes` of
 * `now` (the client's explicit "generate ~5 minutes before, not days
 * ahead" requirement), excluding anything older than `staleCutoffHours`
 * (an ancient never-generated job, e.g. after extended worker downtime,
 * should be cancelled via cancelStaleContentJobs rather than generated
 * for a time that's already long past). Lead time and staleness are
 * caller-supplied, not baked in here, so the policy constants live in one
 * place (apps/worker). */
export function listGenerationCandidates(
  now: Date,
  options: { leadMinutes: number; staleCutoffHours: number; limit: number },
): Promise<ContentJob[]> {
  const dueBy = new Date(now.getTime() + options.leadMinutes * 60_000);
  const staleCutoff = new Date(now.getTime() - options.staleCutoffHours * 60 * 60_000);
  return prisma.contentJob.findMany({
    where: {
      status: { in: ["PENDING", "RETRYING"] },
      scheduledFor: { lte: dueBy, gte: staleCutoff },
    },
    orderBy: { scheduledFor: "asc" },
    take: options.limit,
  });
}

/** Marks any job still PENDING/RETRYING whose scheduledFor is older than
 * the staleness cutoff as CANCELLED, so a job that was never generated in
 * time (e.g. the worker was down) doesn't sit forever looking like it's
 * still "coming soon," and so listGenerationCandidates never has to
 * consider it again. */
export async function cancelStaleContentJobs(
  now: Date,
  staleCutoffHours: number,
): Promise<number> {
  const cutoff = new Date(now.getTime() - staleCutoffHours * 60 * 60_000);
  const result = await prisma.contentJob.updateMany({
    where: { status: { in: ["PENDING", "RETRYING"] }, scheduledFor: { lt: cutoff } },
    data: {
      status: "CANCELLED",
      errorMessage: "Cancelled: scheduled time passed before generation started",
    },
  });
  return result.count;
}

export type ContentJobWithAccounts = ContentJob & {
  organization: { socialAccounts: import("@prisma/client").SocialAccount[] };
};

export interface PublishCandidate {
  publication: ContentPublication;
  job: ContentJobWithAccounts;
}

/** Every PENDING/RETRYING publication belonging to a due, generated
 * (`masterImageUrl` set) job - no attempt-limit or backoff filtering here,
 * since those are policy constants the caller (apps/worker) owns; this is
 * a mechanical "what's eligible to even consider" query. `limit` bounds
 * how many jobs one tick looks at, not a cost control (publishing is free
 * beyond the Graph API calls themselves). Includes each job's org's
 * connected social accounts so the caller doesn't need a second query per
 * candidate to find the right one to publish with. */
export async function listPublishCandidates(
  now: Date,
  limit: number,
): Promise<PublishCandidate[]> {
  const jobs = await prisma.contentJob.findMany({
    where: {
      status: { in: ["READY", "PUBLISHING", "RETRYING"] },
      scheduledFor: { lte: now },
      masterImageUrl: { not: null },
    },
    include: {
      publications: true,
      organization: { include: { socialAccounts: true } },
    },
    orderBy: { scheduledFor: "asc" },
    take: limit,
  });

  const candidates: PublishCandidate[] = [];
  for (const job of jobs) {
    for (const publication of job.publications) {
      if (publication.status === "PENDING" || publication.status === "RETRYING") {
        candidates.push({ publication, job });
      }
    }
  }
  return candidates;
}

/** [dayStart, dayEnd) should be one calendar day's bounds in the org's own
 * timezone, converted to UTC. Same "oldest *valid* row, filtered directly
 * in the query" shape as content-post.ts's findImageForDay (a previous
 * production bug there: fetching only the oldest row and rejecting it
 * client-side with no fallback let one stale row permanently shadow every
 * later valid image for the rest of the day) - re-pointed at ContentJob so
 * the same one-image-per-org-per-day cost rule holds per job instead of
 * per platform call. */
export async function findMasterImageForDay(
  organizationId: string,
  dayStart: Date,
  dayEnd: Date,
  db: Db = prisma,
  createdAfter?: Date,
): Promise<{ masterImageUrl: string; storyImageUrl: string | null } | null> {
  const existing = await db.contentJob.findFirst({
    where: {
      organizationId,
      scheduledFor: { gte: dayStart, lt: dayEnd },
      masterImageUrl: { not: null },
      ...(createdAfter ? { createdAt: { gt: createdAfter } } : {}),
    },
    orderBy: { createdAt: "asc" },
    select: { masterImageUrl: true, storyImageUrl: true },
  });
  if (!existing?.masterImageUrl) return null;
  return { masterImageUrl: existing.masterImageUrl, storyImageUrl: existing.storyImageUrl };
}

/** How many jobs an org has ever had generated for - used as a stable,
 * ever-increasing seed for picking a creative-variation combination so
 * consecutive generations never land on the same one by coincidence. Only
 * counts jobs that reached generation (not PENDING skeletons still
 * waiting on their 5-minute window), so the index doesn't jump around as
 * far-future placeholder jobs get materialized ahead of time. */
export function countGeneratedContentJobs(organizationId: string): Promise<number> {
  return prisma.contentJob.count({
    where: { organizationId, status: { notIn: ["PENDING", "CANCELLED"] } },
  });
}

/** The most recent jobs' creative-variation choices, most recent first -
 * fed back into the next generation's prompt as an explicit "don't repeat
 * these" list. Skips jobs with no metadata (nothing generated for them
 * yet, or a same-day reuse that copied an image without fresh metadata). */
export async function getRecentJobCreativeMetadata(
  organizationId: string,
  limit: number,
): Promise<object[]> {
  const jobs = await prisma.contentJob.findMany({
    where: { organizationId, creativeMetadata: { not: Prisma.JsonNull } },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { creativeMetadata: true },
  });
  return jobs
    .map((job) => job.creativeMetadata)
    .filter((metadata): metadata is object => metadata !== null && typeof metadata === "object");
}

export interface GeneratedContentInput {
  masterImageUrl: string;
  storyImageUrl?: string;
  caption: string;
  hashtags: string[];
  creativeMetadata?: object;
}

/** Writes a freshly generated (or same-day-reused) creative onto a job and
 * marks it READY - the generation cycle's success path. When a fresh
 * image was just generated, this MUST be called with the same transaction
 * client that held withDayImageLock during generation (see
 * generateContentForJob) - the write needs to be committed and visible
 * before the lock releases, or a second job racing for the same calendar
 * day could acquire the lock right after and still find nothing yet. */
export function markContentJobGenerated(
  jobId: string,
  input: GeneratedContentInput,
  db: Db = prisma,
): Promise<ContentJob> {
  return db.contentJob.update({
    where: { id: jobId },
    data: {
      status: "READY",
      masterImageUrl: input.masterImageUrl,
      storyImageUrl: input.storyImageUrl,
      caption: input.caption,
      hashtags: input.hashtags,
      creativeMetadata: input.creativeMetadata,
      // Only set when a fresh image was actually generated (creativeMetadata
      // present) - a same-day reuse costs nothing, so it must not look like
      // a new generation to monthly usage accounting (packages/db/src/usage.ts).
      generatedAt: input.creativeMetadata ? new Date() : undefined,
      errorMessage: null,
    },
  });
}

/** Generation failed - retry (bumping `attempts`) unless the org's own
 * `maxAttempts` policy is exhausted, in which case it's permanently
 * FAILED and the publish cycle will never see it (it only claims jobs
 * with a non-null masterImageUrl). */
export async function markContentJobGenerationFailed(
  jobId: string,
  errorMessage: string,
  maxAttempts: number,
): Promise<ContentJob> {
  const job = await prisma.contentJob.findUniqueOrThrow({ where: { id: jobId } });
  const attempts = job.attempts + 1;
  return prisma.contentJob.update({
    where: { id: jobId },
    data: {
      attempts,
      errorMessage,
      status: attempts >= maxAttempts ? "FAILED" : "RETRYING",
    },
  });
}

/** The org/brand/schedule was no longer ready by the time generation was
 * about to start (subscription lapsed, brand setup incomplete, the slot
 * that produced this job was removed) - cancel rather than generate, so
 * nothing is ever wasted on a job that shouldn't happen anymore. */
export function markContentJobCancelled(jobId: string, reason: string): Promise<ContentJob> {
  return prisma.contentJob.update({
    where: { id: jobId },
    data: { status: "CANCELLED", errorMessage: reason },
  });
}

/** Persists a Graph API publish's returned id BEFORE verification or the
 * Story sub-step - so a crash right after a successful publish call still
 * leaves durable proof that stops a retry from ever calling the publish
 * endpoint again for this platform (Meta's publish endpoints have no
 * idempotency key of their own). */
export function recordContentPublicationExternalId(
  publicationId: string,
  externalPostId: string,
): Promise<ContentPublication> {
  return prisma.contentPublication.update({
    where: { id: publicationId },
    data: { externalPostId },
  });
}

export function markContentPublicationPublished(
  publicationId: string,
  externalPostId: string,
): Promise<ContentPublication> {
  return prisma.contentPublication.update({
    where: { id: publicationId },
    data: { status: "PUBLISHED", externalPostId, publishedAt: new Date() },
  });
}

/** Publishing (or verifying) this platform failed - retry (bumping
 * `attempts`) unless `permanent` says the attempt limit is exhausted. */
export function markContentPublicationFailed(
  publicationId: string,
  errorMessage: string,
  options: { permanent: boolean },
): Promise<ContentPublication> {
  return prisma.contentPublication.update({
    where: { id: publicationId },
    data: {
      errorMessage,
      attempts: { increment: 1 },
      status: options.permanent ? "FAILED" : "RETRYING",
    },
  });
}

/** Best-effort Story sub-publish succeeded - idempotent alongside the main
 * publish (publishStoryBestEffort checks externalStoryId first so a retry
 * of the main platform never re-publishes an already-published Story). */
export function markContentPublicationStoryPublished(
  publicationId: string,
  externalStoryId: string,
): Promise<ContentPublication> {
  return prisma.contentPublication.update({
    where: { id: publicationId },
    data: { externalStoryId },
  });
}

/** Rolls a job's status up from its publications' statuses after a
 * publish attempt: every platform published -> PUBLISHED; anything still
 * mid-attempt -> PUBLISHING; anything still waiting to (re)try ->
 * RETRYING; otherwise (only PUBLISHED/FAILED remain, nothing left to
 * retry automatically) -> FAILED. The per-platform detail (which platform
 * actually succeeded) always lives on the ContentPublication rows
 * themselves - this rollup is a display-level summary, not what publish
 * claiming decisions are based on. */
export async function rollupContentJobStatus(jobId: string): Promise<void> {
  const publications = await prisma.contentPublication.findMany({
    where: { contentJobId: jobId },
  });
  if (publications.length === 0) return;

  let status: ContentJobStatus;
  if (publications.every((p) => p.status === "PUBLISHED")) {
    status = "PUBLISHED";
  } else if (publications.some((p) => p.status === "PUBLISHING")) {
    status = "PUBLISHING";
  } else if (publications.some((p) => p.status === "PENDING" || p.status === "RETRYING")) {
    status = "RETRYING";
  } else {
    status = "FAILED";
  }

  await prisma.contentJob.update({ where: { id: jobId }, data: { status } });
}

// --- Calendar/schedule UI read/write helpers (replace content-post.ts's
// equivalents for all new code - see packages/db/src/content-post.ts for
// why that file and its table are kept around, unused, during the
// deprecation window). ---

/** Lists jobs whose scheduled or published time falls within [start, end) -
 * same "either date can place it" behavior as content-post.ts's
 * listContentPostsInRange, for the calendar month view. */
export function listContentJobsInRange(organizationId: string, start: Date, end: Date) {
  return prisma.contentJob.findMany({
    where: {
      organizationId,
      OR: [
        { scheduledFor: { gte: start, lt: end } },
        { publications: { some: { publishedAt: { gte: start, lt: end } } } },
      ],
    },
    include: { publications: true },
    orderBy: { scheduledFor: "asc" },
  });
}

export function getContentJob(organizationId: string, jobId: string) {
  return prisma.contentJob.findFirst({
    where: { id: jobId, organizationId },
    include: { publications: true },
  });
}

export interface UpdateContentJobInput {
  caption?: string;
  scheduledFor?: Date;
}

/** Edits a job's shared caption and/or scheduled time - scoped to the
 * organization. Rescheduling moves every selected platform together
 * (there's only ever one scheduledFor per job). Returns
 * `{ error: "time_taken" }` rather than silently merging if another job
 * already occupies the target instant. Caller is responsible for only
 * allowing this while the job hasn't started publishing yet. */
export async function rescheduleContentJob(
  organizationId: string,
  jobId: string,
  data: UpdateContentJobInput,
): Promise<ContentJob | { error: "not_found" | "time_taken" }> {
  const job = await prisma.contentJob.findFirst({ where: { id: jobId, organizationId } });
  if (!job) return { error: "not_found" };

  if (data.scheduledFor) {
    const collision = await prisma.contentJob.findFirst({
      where: { organizationId, scheduledFor: data.scheduledFor, NOT: { id: jobId } },
    });
    if (collision) return { error: "time_taken" };
  }

  return prisma.contentJob.update({ where: { id: jobId }, data });
}

/** Removes one platform from a job - deletes just its ContentPublication
 * if other platforms remain, or the whole job (cascading its
 * publications) if it was the last one. Never touches anything already
 * live on the platform (this only removes our own scheduling record). */
export async function removeContentJobPlatform(
  organizationId: string,
  jobId: string,
  platform: Platform,
): Promise<boolean> {
  const job = await prisma.contentJob.findFirst({ where: { id: jobId, organizationId } });
  if (!job) return false;

  const remaining = job.platforms.filter((p) => p !== platform);
  if (remaining.length === 0) {
    await prisma.contentJob.delete({ where: { id: jobId } });
    return true;
  }

  await prisma.$transaction([
    prisma.contentPublication.deleteMany({ where: { contentJobId: jobId, platform } }),
    prisma.contentJob.update({ where: { id: jobId }, data: { platforms: remaining } }),
  ]);
  return true;
}

/** The most recently published platform, for a "last posted" status
 * display - mirrors content-post.ts's getLastPublishedPost's
 * `{platform, publishedAt}` shape exactly, so PublishingStatusCard needs
 * no changes. */
export async function getLastPublishedContentJob(
  organizationId: string,
): Promise<{ platform: Platform; publishedAt: Date | null } | null> {
  const publication = await prisma.contentPublication.findFirst({
    where: { contentJob: { organizationId }, status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
  });
  return publication ? { platform: publication.platform, publishedAt: publication.publishedAt } : null;
}

/** The soonest still-upcoming job, for a "next post" status display -
 * mirrors content-post.ts's getNextScheduledPost shape. Reports the job's
 * first platform (a job can target more than one; the status card only
 * shows one icon, same as it always has for a single-platform post). */
export async function getNextScheduledContentJob(
  organizationId: string,
  now: Date = new Date(),
): Promise<{ platform: Platform; scheduledFor: Date | null } | null> {
  const job = await prisma.contentJob.findFirst({
    where: {
      organizationId,
      scheduledFor: { gt: now },
      status: { notIn: ["CANCELLED"] },
    },
    orderBy: { scheduledFor: "asc" },
  });
  return job ? { platform: job.platforms[0]!, scheduledFor: job.scheduledFor } : null;
}
