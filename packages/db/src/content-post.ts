import type { Platform } from "@prisma/client";
import { prisma } from "./index";

export interface CreateContentPostInput {
  organizationId: string;
  platform: Platform;
  caption?: string;
  hashtags?: string[];
  imageUrls: string[];
  scheduledFor: Date;
}

export function createContentPost(input: CreateContentPostInput) {
  return prisma.contentPost.create({
    data: {
      organizationId: input.organizationId,
      platform: input.platform,
      type: "POST",
      status: "SCHEDULED",
      caption: input.caption,
      hashtags: input.hashtags ?? [],
      imageUrls: input.imageUrls,
      scheduledFor: input.scheduledFor,
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
