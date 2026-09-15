import { afterEach, describe, expect, it } from "vitest";
import {
  cancelStaleContentJobs,
  claimContentJobForGeneration,
  claimContentPublicationForPublishing,
  findMasterImageForDay,
  getContentJob,
  getLastPublishedContentJob,
  getNextScheduledContentJob,
  hasGeneratedContentToday,
  listContentJobsInRange,
  listGenerationCandidates,
  listPublishCandidates,
  markContentJobGenerated,
  materializeContentJob,
  removeContentJobPlatform,
  rescheduleContentJob,
  rollupContentJobStatus,
  syncSlotDrivenContentJobs,
} from "./content-job";
import { prisma } from "./index";

afterEach(async () => {
  await prisma.organization.deleteMany();
});

describe("materializeContentJob", () => {
  it("creates a new job with one publication per platform", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    const scheduledFor = new Date("2026-09-20T18:00:00Z");

    const job = await materializeContentJob({
      organizationId: org.id,
      scheduledFor,
      platforms: ["INSTAGRAM", "FACEBOOK"],
      origin: "SLOT",
    });

    expect(job.status).toBe("PENDING");
    expect(job.platforms.sort()).toEqual(["FACEBOOK", "INSTAGRAM"]);
    const publications = await prisma.contentPublication.findMany({
      where: { contentJobId: job.id },
    });
    expect(publications).toHaveLength(2);
  });

  it("merges a new platform onto an existing job at the same instant instead of creating a duplicate job (no duplicate jobs for one scheduled time)", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    const scheduledFor = new Date("2026-09-20T18:00:00Z");

    const first = await materializeContentJob({
      organizationId: org.id,
      scheduledFor,
      platforms: ["INSTAGRAM"],
      origin: "SLOT",
    });
    const second = await materializeContentJob({
      organizationId: org.id,
      scheduledFor,
      platforms: ["FACEBOOK"],
      origin: "SLOT",
    });

    expect(second.id).toBe(first.id);
    const allJobs = await prisma.contentJob.findMany({ where: { organizationId: org.id } });
    expect(allJobs).toHaveLength(1);
    expect(second.platforms.sort()).toEqual(["FACEBOOK", "INSTAGRAM"]);
  });

  it("is a no-op when every requested platform is already represented", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    const scheduledFor = new Date("2026-09-20T18:00:00Z");
    await materializeContentJob({
      organizationId: org.id,
      scheduledFor,
      platforms: ["INSTAGRAM"],
      origin: "SLOT",
    });

    await materializeContentJob({
      organizationId: org.id,
      scheduledFor,
      platforms: ["INSTAGRAM"],
      origin: "SLOT",
    });

    const publications = await prisma.contentPublication.findMany({
      where: { contentJob: { organizationId: org.id } },
    });
    expect(publications).toHaveLength(1);
  });
});

describe("syncSlotDrivenContentJobs", () => {
  it("creates a job for each desired occurrence", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    const windowStart = new Date("2026-09-20T00:00:00Z");
    const windowEnd = new Date("2026-09-27T00:00:00Z");

    await syncSlotDrivenContentJobs(
      org.id,
      [{ scheduledFor: new Date("2026-09-21T18:00:00Z"), platform: "INSTAGRAM" }],
      windowStart,
      windowEnd,
    );

    const jobs = await prisma.contentJob.findMany({ where: { organizationId: org.id } });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]!.origin).toBe("SLOT");
  });

  it("deletes a PENDING slot-origin job whose occurrence no longer exists (schedule changed before generation)", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    const windowStart = new Date("2026-09-20T00:00:00Z");
    const windowEnd = new Date("2026-09-27T00:00:00Z");

    await syncSlotDrivenContentJobs(
      org.id,
      [{ scheduledFor: new Date("2026-09-21T18:00:00Z"), platform: "INSTAGRAM" }],
      windowStart,
      windowEnd,
    );
    // The slot was since deleted/disabled - no occurrences at all now.
    await syncSlotDrivenContentJobs(org.id, [], windowStart, windowEnd);

    const jobs = await prisma.contentJob.findMany({ where: { organizationId: org.id } });
    expect(jobs).toHaveLength(0);
  });

  it("shrinks a job's platforms instead of deleting it when only one platform is dropped", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    const windowStart = new Date("2026-09-20T00:00:00Z");
    const windowEnd = new Date("2026-09-27T00:00:00Z");
    const scheduledFor = new Date("2026-09-21T18:00:00Z");

    await syncSlotDrivenContentJobs(
      org.id,
      [
        { scheduledFor, platform: "INSTAGRAM" },
        { scheduledFor, platform: "FACEBOOK" },
      ],
      windowStart,
      windowEnd,
    );
    // The Facebook slot was removed - only Instagram remains desired.
    await syncSlotDrivenContentJobs(
      org.id,
      [{ scheduledFor, platform: "INSTAGRAM" }],
      windowStart,
      windowEnd,
    );

    const job = await prisma.contentJob.findFirstOrThrow({ where: { organizationId: org.id } });
    expect(job.platforms).toEqual(["INSTAGRAM"]);
    const publications = await prisma.contentPublication.findMany({
      where: { contentJobId: job.id },
    });
    expect(publications).toHaveLength(1);
  });

  it("never touches a job that has already started generating", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    const windowStart = new Date("2026-09-20T00:00:00Z");
    const windowEnd = new Date("2026-09-27T00:00:00Z");
    const scheduledFor = new Date("2026-09-21T18:00:00Z");

    const job = await materializeContentJob({
      organizationId: org.id,
      scheduledFor,
      platforms: ["INSTAGRAM"],
      origin: "SLOT",
    });
    await prisma.contentJob.update({ where: { id: job.id }, data: { status: "GENERATING" } });

    // The slot disappeared, but generation already started - must survive.
    await syncSlotDrivenContentJobs(org.id, [], windowStart, windowEnd);

    const stillThere = await prisma.contentJob.findUnique({ where: { id: job.id } });
    expect(stillThere).not.toBeNull();
  });

  it("never touches a one-time post, even if it's not among the desired slot occurrences", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    const windowStart = new Date("2026-09-20T00:00:00Z");
    const windowEnd = new Date("2026-09-27T00:00:00Z");
    const scheduledFor = new Date("2026-09-21T18:00:00Z");

    const oneTime = await materializeContentJob({
      organizationId: org.id,
      scheduledFor,
      platforms: ["INSTAGRAM"],
      origin: "ONE_TIME",
    });

    await syncSlotDrivenContentJobs(org.id, [], windowStart, windowEnd);

    const stillThere = await prisma.contentJob.findUnique({ where: { id: oneTime.id } });
    expect(stillThere).not.toBeNull();
  });
});

describe("claim race protection", () => {
  it("claimContentJobForGeneration: only one of two concurrent claims wins", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    const job = await materializeContentJob({
      organizationId: org.id,
      scheduledFor: new Date(),
      platforms: ["INSTAGRAM"],
      origin: "ONE_TIME",
    });

    const [a, b] = await Promise.all([
      claimContentJobForGeneration(job.id),
      claimContentJobForGeneration(job.id),
    ]);

    const winners = [a, b].filter((r) => r !== null);
    expect(winners).toHaveLength(1);
    const updated = await prisma.contentJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(updated.status).toBe("GENERATING");
  });

  it("claimContentPublicationForPublishing: only one of two concurrent claims wins", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    const job = await materializeContentJob({
      organizationId: org.id,
      scheduledFor: new Date(),
      platforms: ["INSTAGRAM"],
      origin: "ONE_TIME",
    });
    const publication = await prisma.contentPublication.findFirstOrThrow({
      where: { contentJobId: job.id },
    });

    const [a, b] = await Promise.all([
      claimContentPublicationForPublishing(publication.id),
      claimContentPublicationForPublishing(publication.id),
    ]);

    const winners = [a, b].filter((r) => r !== null);
    expect(winners).toHaveLength(1);
  });
});

describe("findMasterImageForDay", () => {
  const dayStart = new Date("2026-09-13T00:00:00.000Z");
  const dayEnd = new Date("2026-09-14T00:00:00.000Z");

  it("returns null when nothing has been generated for that day yet", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    expect(await findMasterImageForDay(org.id, dayStart, dayEnd)).toBeNull();
  });

  it("returns the master and story image of a generated job that day", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    const job = await materializeContentJob({
      organizationId: org.id,
      scheduledFor: new Date("2026-09-13T10:00:00.000Z"),
      platforms: ["INSTAGRAM"],
      origin: "ONE_TIME",
    });
    await markContentJobGenerated(job.id, {
      masterImageUrl: "https://example.com/master.png",
      storyImageUrl: "https://example.com/master-story.png",
      caption: "Hi",
      hashtags: [],
    });

    const result = await findMasterImageForDay(org.id, dayStart, dayEnd);
    expect(result?.masterImageUrl).toBe("https://example.com/master.png");
    expect(result?.storyImageUrl).toBe("https://example.com/master-story.png");
  });

  it("ignores jobs scheduled on a different day", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    const job = await materializeContentJob({
      organizationId: org.id,
      scheduledFor: new Date("2026-09-14T10:00:00.000Z"),
      platforms: ["INSTAGRAM"],
      origin: "ONE_TIME",
    });
    await markContentJobGenerated(job.id, {
      masterImageUrl: "https://example.com/other-day.png",
      caption: "Hi",
      hashtags: [],
    });

    expect(await findMasterImageForDay(org.id, dayStart, dayEnd)).toBeNull();
  });

  it("ignores a job that hasn't generated yet (no masterImageUrl)", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    await materializeContentJob({
      organizationId: org.id,
      scheduledFor: new Date("2026-09-13T10:00:00.000Z"),
      platforms: ["INSTAGRAM"],
      origin: "ONE_TIME",
    });

    expect(await findMasterImageForDay(org.id, dayStart, dayEnd)).toBeNull();
  });

  it("returns the day's oldest generated image unconditionally, even after something else changes in between (deliberate - see the function's own doc comment)", async () => {
    // Explicitly no longer "stale-row-aware" - once an image exists for
    // the day, later jobs must always find and reuse THIS one, full stop.
    // Making the day-reuse decision depend on any other timestamp (e.g. a
    // Brand Settings edit) turned out to be an exploitable
    // free-regeneration loophole in production.
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    const firstJob = await materializeContentJob({
      organizationId: org.id,
      scheduledFor: new Date("2026-09-13T09:00:00.000Z"),
      platforms: ["INSTAGRAM"],
      origin: "ONE_TIME",
    });
    await markContentJobGenerated(firstJob.id, {
      masterImageUrl: "https://example.com/first.png",
      caption: "Hi",
      hashtags: [],
    });

    await materializeContentJob({
      organizationId: org.id,
      scheduledFor: new Date("2026-09-13T10:00:00.000Z"),
      platforms: ["FACEBOOK"],
      origin: "ONE_TIME",
    });

    const result = await findMasterImageForDay(org.id, dayStart, dayEnd);
    expect(result?.masterImageUrl).toBe("https://example.com/first.png");
  });
});

describe("hasGeneratedContentToday", () => {
  it("returns false when nothing has generated yet today", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    expect(await hasGeneratedContentToday(org.id, "UTC")).toBe(false);
  });

  it("returns true once a job has generated an image for today", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    const job = await materializeContentJob({
      organizationId: org.id,
      scheduledFor: new Date(),
      platforms: ["INSTAGRAM"],
      origin: "ONE_TIME",
    });
    await markContentJobGenerated(job.id, {
      masterImageUrl: "https://example.com/a.png",
      caption: "Hi",
      hashtags: [],
    });

    expect(await hasGeneratedContentToday(org.id, "UTC")).toBe(true);
  });

  it("respects the organization's own timezone", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    // 23:30 UTC on the 13th is already the 14th in Asia/Karachi (UTC+5).
    const lateUtc = new Date("2026-09-13T23:30:00.000Z");
    const job = await materializeContentJob({
      organizationId: org.id,
      scheduledFor: lateUtc,
      platforms: ["INSTAGRAM"],
      origin: "ONE_TIME",
    });
    await markContentJobGenerated(job.id, {
      masterImageUrl: "https://example.com/a.png",
      caption: "Hi",
      hashtags: [],
    });

    const stillThe13thInKarachi = new Date("2026-09-13T12:00:00.000Z");
    expect(await hasGeneratedContentToday(org.id, "Asia/Karachi", stillThe13thInKarachi)).toBe(
      false,
    );
    expect(await hasGeneratedContentToday(org.id, "Asia/Karachi", lateUtc)).toBe(true);
  });
});

describe("rollupContentJobStatus", () => {
  async function makeJobWithPublications(statuses: Array<"PENDING" | "PUBLISHING" | "PUBLISHED" | "FAILED" | "RETRYING">) {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    const platforms = statuses.map((_, i) => (i === 0 ? "INSTAGRAM" : "FACEBOOK")) as ("INSTAGRAM" | "FACEBOOK")[];
    const job = await materializeContentJob({
      organizationId: org.id,
      scheduledFor: new Date(),
      platforms,
      origin: "ONE_TIME",
    });
    const publications = await prisma.contentPublication.findMany({ where: { contentJobId: job.id } });
    for (const [i, publication] of publications.entries()) {
      await prisma.contentPublication.update({
        where: { id: publication.id },
        data: { status: statuses[i] },
      });
    }
    return job.id;
  }

  it("PUBLISHED when every publication is published", async () => {
    const jobId = await makeJobWithPublications(["PUBLISHED", "PUBLISHED"]);
    await rollupContentJobStatus(jobId);
    expect((await prisma.contentJob.findUniqueOrThrow({ where: { id: jobId } })).status).toBe("PUBLISHED");
  });

  it("RETRYING when one is published and the other is still pending/retrying", async () => {
    const jobId = await makeJobWithPublications(["PUBLISHED", "RETRYING"]);
    await rollupContentJobStatus(jobId);
    expect((await prisma.contentJob.findUniqueOrThrow({ where: { id: jobId } })).status).toBe("RETRYING");
  });

  it("PUBLISHING while any publication is mid-attempt", async () => {
    const jobId = await makeJobWithPublications(["PUBLISHED", "PUBLISHING"]);
    await rollupContentJobStatus(jobId);
    expect((await prisma.contentJob.findUniqueOrThrow({ where: { id: jobId } })).status).toBe("PUBLISHING");
  });

  it("FAILED when nothing is left to retry and not everything published", async () => {
    const jobId = await makeJobWithPublications(["PUBLISHED", "FAILED"]);
    await rollupContentJobStatus(jobId);
    expect((await prisma.contentJob.findUniqueOrThrow({ where: { id: jobId } })).status).toBe("FAILED");
  });
});

describe("listGenerationCandidates / cancelStaleContentJobs", () => {
  it("only returns jobs due within the lead time window", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    const now = new Date("2026-09-15T12:00:00Z");
    const dueSoon = await materializeContentJob({
      organizationId: org.id,
      scheduledFor: new Date("2026-09-15T12:03:00Z"),
      platforms: ["INSTAGRAM"],
      origin: "ONE_TIME",
    });
    await materializeContentJob({
      organizationId: org.id,
      scheduledFor: new Date("2026-09-16T12:00:00Z"), // a day away - not due yet
      platforms: ["INSTAGRAM"],
      origin: "ONE_TIME",
    });

    const candidates = await listGenerationCandidates(now, {
      leadMinutes: 5,
      staleCutoffHours: 24,
      limit: 10,
    });

    expect(candidates.map((c) => c.id)).toEqual([dueSoon.id]);
  });

  it("cancelStaleContentJobs marks an old never-generated job CANCELLED", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    const stale = await materializeContentJob({
      organizationId: org.id,
      scheduledFor: new Date("2026-09-10T12:00:00Z"),
      platforms: ["INSTAGRAM"],
      origin: "ONE_TIME",
    });

    const count = await cancelStaleContentJobs(new Date("2026-09-15T12:00:00Z"), 24);

    expect(count).toBe(1);
    expect((await prisma.contentJob.findUniqueOrThrow({ where: { id: stale.id } })).status).toBe(
      "CANCELLED",
    );
  });
});

describe("listPublishCandidates", () => {
  it("returns pending publications for due, generated jobs, including connected social accounts", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    const job = await materializeContentJob({
      organizationId: org.id,
      scheduledFor: new Date(Date.now() - 60_000),
      platforms: ["INSTAGRAM"],
      origin: "ONE_TIME",
    });
    await markContentJobGenerated(job.id, {
      masterImageUrl: "https://example.com/a.png",
      caption: "Hi",
      hashtags: [],
    });

    const candidates = await listPublishCandidates(new Date(), 10);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.job.id).toBe(job.id);
    expect(candidates[0]!.job.organization.socialAccounts).toEqual([]);
  });

  it("excludes a job that hasn't generated yet", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    await materializeContentJob({
      organizationId: org.id,
      scheduledFor: new Date(Date.now() - 60_000),
      platforms: ["INSTAGRAM"],
      origin: "ONE_TIME",
    });

    expect(await listPublishCandidates(new Date(), 10)).toEqual([]);
  });
});

describe("calendar/schedule UI helpers", () => {
  it("listContentJobsInRange returns jobs within the range, with publications", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    await materializeContentJob({
      organizationId: org.id,
      scheduledFor: new Date("2026-09-15T09:00:00Z"),
      platforms: ["INSTAGRAM", "FACEBOOK"],
      origin: "ONE_TIME",
    });
    await materializeContentJob({
      organizationId: org.id,
      scheduledFor: new Date("2026-10-15T09:00:00Z"),
      platforms: ["INSTAGRAM"],
      origin: "ONE_TIME",
    });

    const results = await listContentJobsInRange(
      org.id,
      new Date("2026-09-01T00:00:00Z"),
      new Date("2026-10-01T00:00:00Z"),
    );

    expect(results).toHaveLength(1);
    expect(results[0]!.publications).toHaveLength(2);
  });

  it("rescheduleContentJob moves the job and rejects a collision with another job's exact time", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    const jobA = await materializeContentJob({
      organizationId: org.id,
      scheduledFor: new Date("2026-09-15T09:00:00Z"),
      platforms: ["INSTAGRAM"],
      origin: "ONE_TIME",
    });
    const jobB = await materializeContentJob({
      organizationId: org.id,
      scheduledFor: new Date("2026-09-16T09:00:00Z"),
      platforms: ["INSTAGRAM"],
      origin: "ONE_TIME",
    });

    const moved = await rescheduleContentJob(org.id, jobA.id, {
      scheduledFor: new Date("2026-09-17T09:00:00Z"),
    });
    expect("error" in moved).toBe(false);

    const collision = await rescheduleContentJob(org.id, jobB.id, {
      scheduledFor: new Date("2026-09-17T09:00:00Z"),
    });
    expect(collision).toEqual({ error: "time_taken" });
  });

  it("removeContentJobPlatform drops one platform, or the whole job if it was the last one", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    const job = await materializeContentJob({
      organizationId: org.id,
      scheduledFor: new Date(),
      platforms: ["INSTAGRAM", "FACEBOOK"],
      origin: "ONE_TIME",
    });

    await removeContentJobPlatform(org.id, job.id, "FACEBOOK");
    let updated = await getContentJob(org.id, job.id);
    expect(updated?.platforms).toEqual(["INSTAGRAM"]);

    await removeContentJobPlatform(org.id, job.id, "INSTAGRAM");
    updated = await getContentJob(org.id, job.id);
    expect(updated).toBeNull();
  });

  it("getLastPublishedContentJob / getNextScheduledContentJob mirror the legacy status-card shape", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    const past = await materializeContentJob({
      organizationId: org.id,
      scheduledFor: new Date(Date.now() - 60_000),
      platforms: ["INSTAGRAM"],
      origin: "ONE_TIME",
    });
    await prisma.contentPublication.updateMany({
      where: { contentJobId: past.id },
      data: { status: "PUBLISHED", publishedAt: new Date() },
    });
    await materializeContentJob({
      organizationId: org.id,
      scheduledFor: new Date(Date.now() + 60_000),
      platforms: ["FACEBOOK"],
      origin: "ONE_TIME",
    });

    const last = await getLastPublishedContentJob(org.id);
    expect(last?.platform).toBe("INSTAGRAM");
    const next = await getNextScheduledContentJob(org.id);
    expect(next?.platform).toBe("FACEBOOK");
  });
});
