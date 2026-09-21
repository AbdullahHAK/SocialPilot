import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "./index";
import {
  findExpiredJobImages,
  findMasterImageForDay,
  JOB_IMAGE_TTL_MS,
  markContentJobsImagesDeleted,
} from "./content-job";

afterEach(async () => {
  await prisma.organization.deleteMany();
});

const NOW = new Date("2026-09-21T12:00:00Z");
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 60 * 60 * 1000);

async function makeOrg() {
  return prisma.organization.create({ data: { name: "Acme" } });
}

async function makeJob(
  organizationId: string,
  overrides: {
    status?: "PUBLISHED" | "FAILED" | "CANCELLED" | "READY" | "RETRYING";
    scheduledFor?: Date;
    generatedAt?: Date | null;
    masterImageUrl?: string | null;
    storyImageUrl?: string | null;
    imagesDeletedAt?: Date | null;
  } = {},
) {
  return prisma.contentJob.create({
    data: {
      organizationId,
      scheduledFor: overrides.scheduledFor ?? hoursAgo(30),
      platforms: ["INSTAGRAM"],
      status: overrides.status ?? "PUBLISHED",
      masterImageUrl:
        overrides.masterImageUrl === undefined ? "https://cdn.test/generated/day.png" : overrides.masterImageUrl,
      storyImageUrl:
        overrides.storyImageUrl === undefined ? "https://cdn.test/stories/day.png" : overrides.storyImageUrl,
      generatedAt: overrides.generatedAt === undefined ? hoursAgo(30) : overrides.generatedAt,
      imagesDeletedAt: overrides.imagesDeletedAt ?? null,
    },
  });
}

describe("findExpiredJobImages", () => {
  it("returns both the post and Story image of a published job older than 24 hours", async () => {
    const org = await makeOrg();
    const job = await makeJob(org.id);

    const result = await findExpiredJobImages(NOW, 50);

    expect(result).toHaveLength(1);
    expect(result[0]!.organizationId).toBe(org.id);
    expect(result[0]!.jobIds).toEqual([job.id]);
    expect(result[0]!.imageUrls.sort()).toEqual([
      "https://cdn.test/generated/day.png",
      "https://cdn.test/stories/day.png",
    ]);
  });

  it("never returns an image before its 24 hours are up", async () => {
    const org = await makeOrg();
    await makeJob(org.id, { scheduledFor: hoursAgo(23), generatedAt: hoursAgo(23) });

    expect(await findExpiredJobImages(NOW, 50)).toEqual([]);
    expect(JOB_IMAGE_TTL_MS).toBe(24 * 60 * 60 * 1000);
  });

  it("waits for the generation time too, not just the scheduled time", async () => {
    const org = await makeOrg();
    await makeJob(org.id, { scheduledFor: hoursAgo(30), generatedAt: hoursAgo(10) });

    expect(await findExpiredJobImages(NOW, 50)).toEqual([]);
  });

  it("never returns an image for a job that hasn't finished (still waiting to publish or retry)", async () => {
    const org = await makeOrg();
    await makeJob(org.id, { status: "READY" });
    await makeJob(org.id, {
      status: "RETRYING",
      scheduledFor: hoursAgo(31),
      masterImageUrl: "https://cdn.test/generated/other.png",
    });

    expect(await findExpiredJobImages(NOW, 50)).toEqual([]);
  });

  it("keeps a shared same-day image until EVERY job using it is finished and old enough", async () => {
    const org = await makeOrg();
    await makeJob(org.id, { status: "PUBLISHED", scheduledFor: hoursAgo(40) });
    await makeJob(org.id, { status: "READY", scheduledFor: hoursAgo(30), generatedAt: null });

    expect(await findExpiredJobImages(NOW, 50)).toEqual([]);
  });

  it("returns one group covering every job sharing the image once all are done", async () => {
    const org = await makeOrg();
    const first = await makeJob(org.id, { scheduledFor: hoursAgo(40) });
    const second = await makeJob(org.id, { scheduledFor: hoursAgo(30), generatedAt: null });

    const result = await findExpiredJobImages(NOW, 50);

    expect(result).toHaveLength(1);
    expect(result[0]!.jobIds.sort()).toEqual([first.id, second.id].sort());
  });

  it("never touches a logo, Brand Style image, or concept image, even if a job somehow pointed at one", async () => {
    const org = await makeOrg();
    await prisma.brandProfile.create({
      data: {
        organizationId: org.id,
        businessName: "Acme",
        language: "en",
        logoUrl: "https://cdn.test/generated/day.png",
      },
    });
    await prisma.brandCreativeProfile.create({
      data: {
        organizationId: org.id,
        referenceImageUrls: ["https://cdn.test/stories/day.png"],
      },
    });
    await makeJob(org.id);

    const result = await findExpiredJobImages(NOW, 50);

    expect(result).toHaveLength(1);
    expect(result[0]!.imageUrls).toEqual([]);
  });

  it("skips jobs whose images were already deleted, and jobs that never had an image", async () => {
    const org = await makeOrg();
    await makeJob(org.id, { imagesDeletedAt: hoursAgo(1) });
    await makeJob(org.id, {
      status: "CANCELLED",
      scheduledFor: hoursAgo(50),
      masterImageUrl: null,
      storyImageUrl: null,
      generatedAt: null,
    });

    expect(await findExpiredJobImages(NOW, 50)).toEqual([]);
  });
});

describe("markContentJobsImagesDeleted", () => {
  it("flags the jobs, after which they are no longer found and their image can't be reused for the day", async () => {
    const org = await makeOrg();
    const job = await makeJob(org.id, { scheduledFor: hoursAgo(30) });

    await markContentJobsImagesDeleted([job.id], NOW);

    const updated = await prisma.contentJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(updated.imagesDeletedAt).toEqual(NOW);
    expect(updated.masterImageUrl).toBe("https://cdn.test/generated/day.png");
    expect(await findExpiredJobImages(NOW, 50)).toEqual([]);
    expect(
      await findMasterImageForDay(org.id, hoursAgo(48), new Date(NOW.getTime() + 60_000)),
    ).toBeNull();
  });
});
