import {
  Prisma,
  type ContentJob,
  type ContentJobOrigin,
  type ContentJobStatus,
  type ContentPublication,
  type Platform,
} from "@prisma/client";
import { prisma } from "./index";
import { getLocalDayBoundsUtc } from "./timezone";

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
  organization: {
    socialAccounts: import("@prisma/client").SocialAccount[];
    status: import("@prisma/client").OrganizationStatus;
    publishingSchedule: {
      publishMode: import("@prisma/client").PublishMode;
      includeCaption: boolean;
    } | null;
  };
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
      organization: {
        include: {
          socialAccounts: true,
          publishingSchedule: { select: { publishMode: true, includeCaption: true } },
        },
      },
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
 * timezone, converted to UTC. Finds the oldest job that already generated
 * a master image that day and returns it unconditionally - once an image
 * exists for a calendar day, it is reused for every remaining post that
 * day, full stop, regardless of anything else that changes in between
 * (e.g. a Brand Settings edit). This is a deliberate cost-control choice:
 * an earlier version of this function also rejected an image as "stale"
 * if the brand/creative profile had been edited after it was generated,
 * so a correction would force a fresh generation the same day - but that
 * made the brand-edit timestamp exploitable as a free-regeneration
 * loophole (edit Brand Settings between each scheduled post's generation
 * window to force a new image every time, still under the monthly cap
 * but defeating the "one image per day" pacing it's meant to guarantee).
 * A same-day edit is still fully respected - it just takes effect
 * starting the *next* calendar day rather than retroactively invalidating
 * today's already-generated image. See hasGeneratedContentToday, used by
 * the Brand Settings action to tell the user exactly that. */
export async function findMasterImageForDay(
  organizationId: string,
  dayStart: Date,
  dayEnd: Date,
  db: Db = prisma,
): Promise<{ masterImageUrl: string; storyImageUrl: string | null } | null> {
  const existing = await db.contentJob.findFirst({
    where: {
      organizationId,
      scheduledFor: { gte: dayStart, lt: dayEnd },
      masterImageUrl: { not: null },
      // A deleted file can't be reused - see findExpiredJobImages.
      imagesDeletedAt: null,
    },
    orderBy: { createdAt: "asc" },
    select: { masterImageUrl: true, storyImageUrl: true },
  });
  if (!existing?.masterImageUrl) return null;
  return { masterImageUrl: existing.masterImageUrl, storyImageUrl: existing.storyImageUrl };
}

/** Whether this organization already has a generated master image for its
 * *current* calendar day (in its own timezone) - used to tell a business
 * editing Brand Settings whether their change will affect today's content
 * or only take effect starting tomorrow, per findMasterImageForDay's
 * unconditional same-day reuse. */
export async function hasGeneratedContentToday(
  organizationId: string,
  timezone: string,
  now: Date = new Date(),
): Promise<boolean> {
  const { start, end } = getLocalDayBoundsUtc(now, timezone);
  return (await findMasterImageForDay(organizationId, start, end)) !== null;
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

/** `externalPostId` is null for a Story-only publish - there's no feed post
 * to point at, the Story's own id lives in `externalStoryId`. */
export function markContentPublicationPublished(
  publicationId: string,
  externalPostId: string | null,
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
  hashtags?: string[];
  captionInstruction?: string;
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

// --- Daily post/Story image expiry ---

/** How long a job's images stay in storage after its post went out. The
 * client's explicit rule: published images must not pile up in storage,
 * but nothing may be deleted early - the same day's image is shared by
 * every platform's post that day (and by the Story), so it only goes once
 * the whole day's posts are done with it. */
export const JOB_IMAGE_TTL_MS = 24 * 60 * 60 * 1000;

const TERMINAL_JOB_STATUSES: ContentJobStatus[] = ["PUBLISHED", "FAILED", "CANCELLED"];

export interface ExpiredJobImages {
  organizationId: string;
  /** Every job (across the shared same-day image) to flag once the files are gone. */
  jobIds: string[];
  /** Files safe to delete from storage - never a logo or Brand Style image. */
  imageUrls: string[];
}

/** Finds daily-post/Story image files that are past their 24 hours and no
 * longer needed. An image is only returned once EVERY job sharing it (same-day
 * reuse copies one image onto several jobs) is finished - published, failed,
 * or cancelled - and old enough by both its scheduled and generated time, so
 * nothing still waiting to publish or retry ever loses its image. Logos,
 * Brand Style images and concept images are filtered out as a second
 * safeguard: a job's own image should never equal one of those, but deleting
 * one of them is unrecoverable, so it's checked rather than assumed. */
export async function findExpiredJobImages(
  now: Date,
  limit: number,
): Promise<ExpiredJobImages[]> {
  const cutoff = new Date(now.getTime() - JOB_IMAGE_TTL_MS);
  type Timed = { status: ContentJobStatus; scheduledFor: Date; generatedAt: Date | null };
  const isFinishedAndOld = (job: Timed) =>
    TERMINAL_JOB_STATUSES.includes(job.status) &&
    job.scheduledFor < cutoff &&
    (job.generatedAt === null || job.generatedAt < cutoff);

  const candidates = await prisma.contentJob.findMany({
    where: {
      imagesDeletedAt: null,
      masterImageUrl: { not: null },
      status: { in: TERMINAL_JOB_STATUSES },
      scheduledFor: { lt: cutoff },
      OR: [{ generatedAt: null }, { generatedAt: { lt: cutoff } }],
    },
    orderBy: { scheduledFor: "asc" },
    take: limit,
    select: { organizationId: true, masterImageUrl: true },
  });

  const groups = new Map<string, { organizationId: string; masterImageUrl: string }>();
  for (const job of candidates) {
    groups.set(`${job.organizationId}|${job.masterImageUrl}`, {
      organizationId: job.organizationId,
      masterImageUrl: job.masterImageUrl!,
    });
  }

  const protectedByOrg = new Map<string, Set<string>>();
  async function protectedUrls(organizationId: string): Promise<Set<string>> {
    const cached = protectedByOrg.get(organizationId);
    if (cached) return cached;
    const [brand, creative, concepts] = await Promise.all([
      prisma.brandProfile.findUnique({ where: { organizationId }, select: { logoUrl: true } }),
      prisma.brandCreativeProfile.findUnique({
        where: { organizationId },
        select: { referenceImageUrls: true },
      }),
      prisma.creativeConcept.findMany({ where: { organizationId }, select: { imageUrls: true } }),
    ]);
    const urls = new Set<string>();
    if (brand?.logoUrl) urls.add(brand.logoUrl);
    creative?.referenceImageUrls.forEach((url) => urls.add(url));
    concepts.forEach((concept) => concept.imageUrls.forEach((url) => urls.add(url)));
    protectedByOrg.set(organizationId, urls);
    return urls;
  }

  const result: ExpiredJobImages[] = [];
  for (const { organizationId, masterImageUrl } of groups.values()) {
    const sharing = await prisma.contentJob.findMany({
      where: { organizationId, masterImageUrl },
      select: {
        id: true,
        status: true,
        scheduledFor: true,
        generatedAt: true,
        imagesDeletedAt: true,
        storyImageUrl: true,
      },
    });
    if (!sharing.every((job) => job.imagesDeletedAt !== null || isFinishedAndOld(job))) continue;

    const guarded = await protectedUrls(organizationId);
    const urls = new Set<string>([masterImageUrl]);
    sharing.forEach((job) => job.storyImageUrl && urls.add(job.storyImageUrl));

    result.push({
      organizationId,
      jobIds: sharing.filter((job) => job.imagesDeletedAt === null).map((job) => job.id),
      imageUrls: [...urls].filter((url) => !guarded.has(url)),
    });
  }
  return result;
}

/** Flags jobs whose image files were deleted, so the calendar shows an
 * "image removed" placeholder. The URLs themselves stay on the row (see
 * ContentJob.imagesDeletedAt). */
export function markContentJobsImagesDeleted(jobIds: string[], now: Date = new Date()) {
  return prisma.contentJob.updateMany({
    where: { id: { in: jobIds } },
    data: { imagesDeletedAt: now },
  });
}

// --- Stuck-generation safety net ---

export interface ReleaseStuckGeneratingOptions {
  /** A job claimed for generation this long ago and still GENERATING was
   * abandoned (a generation takes seconds to a couple of minutes). */
  stuckAfterMinutes: number;
  /** A stranded job is retried only if its scheduled time is at most this
   * far in the past; later than that it is cancelled instead - a post
   * hours late is not what the schedule promised. */
  maxLateMinutes: number;
  maxAttempts: number;
}

export interface ReleasedStuckJobs {
  retried: number;
  failed: number;
  cancelled: number;
}

/** A job is claimed (PENDING/RETRYING -> GENERATING) before any work starts,
 * so if the worker dies mid-generation - a crash, a deploy restart, an
 * unexpected error - the job stays GENERATING forever: nothing else ever
 * picks up a GENERATING job, and the calendar shows "generating" for a post
 * that will never go out. This releases those. Each one is updated only if
 * it is still GENERATING with the same lastAttemptAt it was read with, so a
 * generation that finishes at the last moment is never overwritten.
 * Retries bump `attempts` (so a job that keeps killing the worker ends up
 * FAILED instead of looping); a job whose scheduled time is already well
 * past is cancelled rather than published late. */
export async function releaseStuckGeneratingJobs(
  now: Date,
  options: ReleaseStuckGeneratingOptions,
): Promise<ReleasedStuckJobs> {
  const stuckBefore = new Date(now.getTime() - options.stuckAfterMinutes * 60_000);
  const retryableAfter = new Date(now.getTime() - options.maxLateMinutes * 60_000);

  const stuck = await prisma.contentJob.findMany({
    where: {
      status: "GENERATING",
      OR: [{ lastAttemptAt: null }, { lastAttemptAt: { lt: stuckBefore } }],
    },
    select: { id: true, attempts: true, scheduledFor: true, lastAttemptAt: true },
    take: 200,
  });

  const released: ReleasedStuckJobs = { retried: 0, failed: 0, cancelled: 0 };
  for (const job of stuck) {
    let outcome: keyof ReleasedStuckJobs;
    let data: Prisma.ContentJobUpdateManyMutationInput;
    if (job.scheduledFor < retryableAfter) {
      outcome = "cancelled";
      data = {
        status: "CANCELLED",
        errorMessage: "Cancelled: generation was interrupted and the scheduled time had already passed",
      };
    } else if (job.attempts + 1 >= options.maxAttempts) {
      outcome = "failed";
      data = {
        status: "FAILED",
        attempts: { increment: 1 },
        errorMessage: "Generation was interrupted repeatedly",
      };
    } else {
      outcome = "retried";
      data = {
        status: "RETRYING",
        attempts: { increment: 1 },
        errorMessage: "Generation was interrupted - retrying",
      };
    }

    const result = await prisma.contentJob.updateMany({
      where: { id: job.id, status: "GENERATING", lastAttemptAt: job.lastAttemptAt },
      data,
    });
    if (result.count > 0) released[outcome]++;
  }
  return released;
}
