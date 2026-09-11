import { prisma } from "./index";

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
