import { Prisma, type Platform } from "@prisma/client";
import { prisma } from "./index";

// Either the module-level client or a transaction client from
// withDayImageLock - lets findImageForDay/createContentPost run either
// standalone (existing callers, tests) or inside the locked transaction
// that makes the day-image check-then-generate sequence atomic.
type Db = Pick<typeof prisma, "contentPost">;

export interface CreateContentPostInput {
  organizationId: string;
  platform: Platform;
  caption?: string;
  hashtags?: string[];
  imageUrls: string[];
  storyImageUrl?: string;
  // The creative-variation choices behind imageUrls, when a fresh image
  // was generated for this post - omitted when reusing another post's
  // same-day image, since there's nothing new to record.
  creativeMetadata?: object;
  scheduledFor: Date;
}

export function createContentPost(input: CreateContentPostInput, db: Db = prisma) {
  return db.contentPost.create({
    data: {
      organizationId: input.organizationId,
      platform: input.platform,
      type: "POST",
      status: "SCHEDULED",
      caption: input.caption,
      hashtags: input.hashtags ?? [],
      imageUrls: input.imageUrls,
      storyImageUrl: input.storyImageUrl,
      creativeMetadata: input.creativeMetadata,
      scheduledFor: input.scheduledFor,
    },
  });
}

/**
 * Serializes the "does today already have an image? if not, generate one"
 * sequence per organization+day using a Postgres advisory lock, so two
 * requests landing close together (a double-click, a retry, two platforms
 * submitted at once) can't both see "nothing yet" and both pay for a fresh
 * AI generation - discovered in production when exactly this happened
 * several times in one day. `fn` receives a transaction client to run its
 * own findImageForDay/createContentPost calls through, so a request that
 * loses the race blocks until the winner commits, then re-checks and finds
 * the winner's image instead of generating its own. The generous timeout
 * accounts for `fn` doing real work (an OpenAI call, an upload) while
 * holding the lock, not just a couple of queries.
 */
export function withDayImageLock<T>(
  organizationId: string,
  dayKey: string,
  fn: (db: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${organizationId}:${dayKey}`}))`;
      return fn(tx);
    },
    { timeout: 120_000, maxWait: 120_000 },
  );
}

/** The most recent posts' creative-variation choices, most recent first -
 * fed back into the next generation's prompt as an explicit "don't repeat
 * these" list, on top of the deterministic cycling that already keeps
 * consecutive posts on different axes. Skips rows with no metadata (a
 * reused same-day image, or content from before this field existed). */
export async function getRecentCreativeMetadata(
  organizationId: string,
  limit: number,
): Promise<object[]> {
  const posts = await prisma.contentPost.findMany({
    where: { organizationId, type: "POST", creativeMetadata: { not: Prisma.JsonNull } },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { creativeMetadata: true },
  });
  return posts
    .map((p) => p.creativeMetadata)
    .filter((m): m is object => m !== null && typeof m === "object");
}

/** How many posts an org has ever had generated - used as a stable,
 * ever-increasing seed for picking a theme/treatment so consecutive posts
 * (whether triggered by the cron job, a new schedule slot, or a one-time
 * date) never land on the same combination by coincidence. */
export function countContentPosts(organizationId: string): Promise<number> {
  return prisma.contentPost.count({ where: { organizationId } });
}

/** Finds an already-generated image to reuse for another post landing on
 * the same calendar day - the client's explicit cost rule is at most one
 * AI image generation per day, regardless of how many platforms or posts
 * are scheduled that day. [dayStart, dayEnd) should be one calendar day's
 * bounds in the org's own timezone, converted to UTC (see
 * getLocalDayBoundsUtc). Returns null if nothing's been generated yet for
 * that day, meaning a fresh image is actually needed. */
export async function findImageForDay(
  organizationId: string,
  dayStart: Date,
  dayEnd: Date,
  db: Db = prisma,
): Promise<{ imageUrl: string; storyImageUrl: string | null; createdAt: Date } | null> {
  const existing = await db.contentPost.findFirst({
    where: {
      organizationId,
      type: "POST",
      scheduledFor: { gte: dayStart, lt: dayEnd },
      imageUrls: { isEmpty: false },
    },
    orderBy: { createdAt: "asc" },
    select: { imageUrls: true, storyImageUrl: true, createdAt: true },
  });
  if (!existing) return null;
  return {
    imageUrl: existing.imageUrls[0]!,
    storyImageUrl: existing.storyImageUrl,
    createdAt: existing.createdAt,
  };
}

export interface RecordPublishedStoryInput {
  organizationId: string;
  platform: Platform;
  caption?: string;
  hashtags?: string[];
  imageUrls: string[];
  externalPostId: string;
}

/** Records a Story that was published immediately (right after its
 * matching feed post), rather than scheduled ahead of time - there's no
 * "SCHEDULED" phase for it to go through. */
export function recordPublishedStory(input: RecordPublishedStoryInput) {
  const now = new Date();
  return prisma.contentPost.create({
    data: {
      organizationId: input.organizationId,
      platform: input.platform,
      type: "STORY",
      status: "PUBLISHED",
      caption: input.caption,
      hashtags: input.hashtags ?? [],
      imageUrls: input.imageUrls,
      scheduledFor: now,
      publishedAt: now,
      externalPostId: input.externalPostId,
    },
  });
}

/** Posts due to publish now, with the connected social account for their
 * platform preloaded so the worker doesn't need a second query per post. */
export function listDuePosts(now: Date = new Date()) {
  return prisma.contentPost.findMany({
    where: { status: "SCHEDULED", scheduledFor: { lte: now } },
    include: { organization: { include: { socialAccounts: true } } },
  });
}

export function markContentPostPublished(id: string, externalPostId: string) {
  return prisma.contentPost.update({
    where: { id },
    data: { status: "PUBLISHED", publishedAt: new Date(), externalPostId },
  });
}

export function markContentPostFailed(id: string, errorMessage: string) {
  return prisma.contentPost.update({
    where: { id },
    data: { status: "FAILED", errorMessage },
  });
}

/** The most recently published post, for a "last posted" status display. */
export function getLastPublishedPost(organizationId: string) {
  return prisma.contentPost.findFirst({
    where: { organizationId, status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
  });
}

/** The soonest still-upcoming scheduled post, for a "next post" status
 * display - excludes anything already due, since that's the worker's job
 * to have picked up, not something to show as "upcoming". */
export function getNextScheduledPost(organizationId: string, now: Date = new Date()) {
  return prisma.contentPost.findFirst({
    where: { organizationId, status: "SCHEDULED", scheduledFor: { gt: now } },
    orderBy: { scheduledFor: "asc" },
  });
}

/**
 * Lists content posts whose scheduled or published date falls within
 * [start, end), for rendering a calendar month view. A post counts as
 * "in range" if either its scheduledFor or publishedAt date lands there,
 * since a post can be scheduled for one date and actually publish (or
 * fail) on another.
 */
export function listContentPostsInRange(
  organizationId: string,
  start: Date,
  end: Date,
) {
  return prisma.contentPost.findMany({
    where: {
      organizationId,
      OR: [
        { scheduledFor: { gte: start, lt: end } },
        { publishedAt: { gte: start, lt: end } },
      ],
    },
    orderBy: [{ scheduledFor: "asc" }, { publishedAt: "asc" }],
  });
}

/** Fetches one post scoped to the organization - used before an edit to
 * check its current status (e.g. whether it's already published, which
 * changes what's safe to edit) without exposing other orgs' posts. */
export function getContentPost(organizationId: string, postId: string) {
  return prisma.contentPost.findFirst({ where: { id: postId, organizationId } });
}

export interface UpdateContentPostInput {
  caption?: string;
  scheduledFor?: Date;
}

/** Edits a post's caption and/or scheduled time - scoped to the
 * organization like updateScheduleSlot, so one org can never touch
 * another's posts. */
export async function updateContentPost(
  organizationId: string,
  postId: string,
  data: UpdateContentPostInput,
) {
  const post = await prisma.contentPost.findFirst({
    where: { id: postId, organizationId },
  });
  if (!post) return null;
  return prisma.contentPost.update({ where: { id: postId }, data });
}

/** Removes a post from the calendar - scoped to the organization like
 * deleteScheduleSlot. */
export async function deleteContentPost(
  organizationId: string,
  postId: string,
): Promise<boolean> {
  const result = await prisma.contentPost.deleteMany({
    where: { id: postId, organizationId },
  });
  return result.count > 0;
}
