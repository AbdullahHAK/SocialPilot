/**
 * One-off migration: backfills a ContentJob (+ one ContentPublication per
 * platform) for every existing ContentPost row, so the new job-based
 * calendar/schedule/publishing code has something to read from day one
 * instead of an empty table. Safe to re-run - any (organizationId,
 * scheduledFor) that already has a ContentJob is skipped entirely, so a
 * partial or repeated run never creates duplicates.
 *
 * Run with: pnpm --filter @socialpilot/db exec tsx scripts/backfill-content-jobs.ts
 * (via the root's `dotenv -e .env --` wrapper, or with production env vars
 * already in the environment when backfilling production).
 *
 * Status mapping is the one non-obvious part: a legacy ContentPost row
 * only ever existed *after* its image had already been generated (the old
 * pipeline generated eagerly, at schedule-creation time) - so a legacy
 * SCHEDULED row must map the JOB to READY (not PENDING), or the new
 * generation cycle would try to re-generate a backfilled job that's
 * actually just waiting to publish. The PUBLICATION for that same row
 * correctly stays PENDING - that's what the publish cycle should still
 * pick up.
 */
import { PrismaClient, type ContentPost, type Platform } from "@prisma/client";

const prisma = new PrismaClient();
const MAX_ATTEMPTS_SENTINEL = 999; // pre-exhausted, so a backfilled FAILED row never becomes newly retry-eligible

function groupKey(organizationId: string, scheduledFor: Date): string {
  return `${organizationId}:${scheduledFor.toISOString()}`;
}

async function main() {
  const posts = await prisma.contentPost.findMany({
    where: { type: "POST", scheduledFor: { not: null } },
    orderBy: { createdAt: "asc" },
  });

  const groups = new Map<string, ContentPost[]>();
  for (const post of posts) {
    const key = groupKey(post.organizationId, post.scheduledFor!);
    const group = groups.get(key) ?? [];
    group.push(post);
    groups.set(key, group);
  }

  console.log(`Found ${posts.length} legacy POST rows in ${groups.size} (org, scheduledFor) groups.`);

  let created = 0;
  let skipped = 0;
  // Maps a legacy ContentPost id to the new ContentPublication id it became
  // - used by the Story-matching pass below.
  const publicationIdByPostId = new Map<string, string>();

  for (const [, group] of groups) {
    const first = group[0]!;
    const existingJob = await prisma.contentJob.findUnique({
      where: {
        organizationId_scheduledFor: {
          organizationId: first.organizationId,
          scheduledFor: first.scheduledFor!,
        },
      },
    });
    if (existingJob) {
      skipped++;
      continue;
    }

    const platforms = [...new Set(group.map((p) => p.platform))] as Platform[];
    const withMetadata = group.find((p) => p.creativeMetadata !== null) ?? first;
    const status = mapJobStatus(group);

    const job = await prisma.contentJob.create({
      data: {
        organizationId: first.organizationId,
        scheduledFor: first.scheduledFor!,
        platforms,
        origin: "SLOT",
        status,
        caption: first.caption,
        hashtags: first.hashtags,
        masterImageUrl: withMetadata.imageUrls[0] ?? first.imageUrls[0],
        storyImageUrl: withMetadata.storyImageUrl ?? first.storyImageUrl,
        creativeMetadata: withMetadata.creativeMetadata ?? undefined,
        createdAt: first.createdAt,
      },
    });

    // A group can (rarely) contain more than one row for the SAME
    // platform - real historical evidence of the exact race-condition bug
    // this feature fixes (e.g. two genuinely-published Instagram posts
    // a minute apart, both nominally "the same" scheduled time). The new
    // model allows only one ContentPublication per (job, platform), so
    // the earliest-created row per platform becomes the record here;
    // any later duplicate is skipped (never deleted - it's still sitting
    // in the untouched legacy content_posts table) and logged for a human
    // to review if it matters historically.
    const seenPlatforms = new Set<Platform>();
    for (const post of group) {
      if (seenPlatforms.has(post.platform)) {
        console.warn(
          `Skipping duplicate-platform row ${post.id} (${post.platform}) in group ${first.organizationId}:${first.scheduledFor!.toISOString()} - already represented by an earlier row.`,
        );
        continue;
      }
      seenPlatforms.add(post.platform);

      const publication = await prisma.contentPublication.create({
        data: {
          contentJobId: job.id,
          platform: post.platform,
          status: mapPublicationStatus(post.status),
          externalPostId: post.externalPostId,
          publishedAt: post.publishedAt,
          errorMessage: post.errorMessage,
          attempts: post.status === "FAILED" ? MAX_ATTEMPTS_SENTINEL : 0,
        },
      });
      publicationIdByPostId.set(post.id, publication.id);
    }

    created++;
  }

  console.log(`Created ${created} content jobs, skipped ${skipped} already-backfilled.`);

  // Second pass: STORY rows have no FK to the post they came from -
  // correlate by "nearest preceding same-org/platform published post",
  // mirroring how publishStoryBestEffort always ran right after
  // markContentPostPublished for the same post. Best-effort and
  // informational only (it just enables future idempotent story retries) -
  // an unmatched story is logged and left alone, never blocking.
  const stories = await prisma.contentPost.findMany({
    where: { type: "STORY", status: "PUBLISHED", publishedAt: { not: null } },
    orderBy: { publishedAt: "asc" },
  });
  const publishedPosts = posts.filter((p) => p.status === "PUBLISHED" && p.publishedAt);

  let storiesMatched = 0;
  for (const story of stories) {
    const match = publishedPosts
      .filter(
        (p) =>
          p.organizationId === story.organizationId &&
          p.platform === story.platform &&
          p.publishedAt! <= story.publishedAt! &&
          story.publishedAt!.getTime() - p.publishedAt!.getTime() < 5 * 60_000,
      )
      .sort((a, b) => b.publishedAt!.getTime() - a.publishedAt!.getTime())[0];

    if (!match) continue;
    const publicationId = publicationIdByPostId.get(match.id);
    if (!publicationId) continue;

    await prisma.contentPublication.update({
      where: { id: publicationId },
      data: { externalStoryId: story.externalPostId },
    });
    storiesMatched++;
  }

  console.log(`Matched ${storiesMatched} of ${stories.length} legacy Story rows to their post's publication.`);

  await prisma.$disconnect();
}

function mapJobStatus(group: ContentPost[]): "READY" | "PUBLISHED" | "FAILED" {
  if (group.every((p) => p.status === "PUBLISHED")) return "PUBLISHED";
  if (group.every((p) => p.status === "FAILED")) return "FAILED";
  // A mix (e.g. Instagram published, Facebook failed) or anything still
  // SCHEDULED - READY is the safe default: the publish cycle picks up
  // whichever individual publications are still PENDING, and never
  // re-publishes the ones already PUBLISHED (see mapPublicationStatus).
  return "READY";
}

function mapPublicationStatus(status: ContentPost["status"]): "PENDING" | "PUBLISHED" | "FAILED" {
  if (status === "PUBLISHED") return "PUBLISHED";
  if (status === "FAILED") return "FAILED";
  return "PENDING";
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
