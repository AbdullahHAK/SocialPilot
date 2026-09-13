import { getBrandCreativeProfile, prisma, upsertBrandProfile } from "@socialpilot/db";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CONTENT_THEMES, generateAndScheduleContent } from "./generate-content";

// A real (if trivial) 1x1 PNG so createStoryImage can actually process it,
// rather than a fake buffer that would just make that best-effort step
// fail silently.
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

// Each call gets a unique URL (rather than a fixed one) so tests can tell
// "generated fresh" apart from "reused the same upload".
const uploadGeneratedImageMock = vi
  .fn()
  .mockImplementation((_orgId: string, _buffer: Buffer, prefix = "generated") =>
    Promise.resolve(`https://example.com/${prefix}-${uploadGeneratedImageMock.mock.calls.length}.png`),
  );

vi.mock("./storage", () => ({
  uploadGeneratedImage: (...args: unknown[]) => uploadGeneratedImageMock(...args),
}));

const generateImageMock = vi.fn().mockResolvedValue(TINY_PNG);
const generateCaptionMock = vi
  .fn()
  .mockResolvedValue({ caption: "Hello!", hashtags: ["promo"] });

vi.mock("./openai", () => ({
  generateImage: (...args: unknown[]) => generateImageMock(...args),
  generateCaption: (...args: unknown[]) => generateCaptionMock(...args),
}));

afterEach(async () => {
  await prisma.organization.deleteMany();
  generateImageMock.mockClear();
  generateCaptionMock.mockClear();
  uploadGeneratedImageMock.mockClear();
});

async function setUpReadyOrg(name = "Acme") {
  const org = await prisma.organization.create({
    data: { name, publishingSchedule: { create: {} } },
  });
  await upsertBrandProfile({
    organizationId: org.id,
    businessName: name,
    language: "en",
    logoUrl: "https://example.com/logo.png",
  });
  await prisma.brandCreativeProfile.create({
    data: {
      organizationId: org.id,
      referenceImageUrls: ["https://example.com/style.png"],
      promptTemplateAdditions: "on-brand promo content",
    },
  });
  return org;
}

describe("generateAndScheduleContent", () => {
  it("skips as not_ready when there's no approved creative profile", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    await upsertBrandProfile({
      organizationId: org.id,
      businessName: "Acme",
      language: "en",
      logoUrl: "https://example.com/logo.png",
    });

    const result = await generateAndScheduleContent({
      organizationId: org.id,
      platform: "INSTAGRAM",
      scheduledFor: new Date(),
    });

    expect(result).toEqual({ success: false, skipped: "not_ready" });
  });

  it("skips as not_ready when there's no logo yet", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    await upsertBrandProfile({
      organizationId: org.id,
      businessName: "Acme",
      language: "en",
    });
    await prisma.brandCreativeProfile.create({
      data: { organizationId: org.id, referenceImageUrls: ["https://example.com/style.png"] },
    });

    const result = await generateAndScheduleContent({
      organizationId: org.id,
      platform: "INSTAGRAM",
      scheduledFor: new Date(),
    });

    expect(result).toEqual({ success: false, skipped: "not_ready" });
  });

  it("generates and schedules a post, including a Story-format image, when the brand is ready", async () => {
    const org = await setUpReadyOrg();

    const scheduledFor = new Date("2026-09-15T09:00:00Z");
    const result = await generateAndScheduleContent({
      organizationId: org.id,
      platform: "FACEBOOK",
      scheduledFor,
    });

    expect(result).toEqual({ success: true });
    const post = await prisma.contentPost.findFirst({ where: { organizationId: org.id } });
    expect(post?.status).toBe("SCHEDULED");
    expect(post?.imageUrls[0]).toMatch(/^https:\/\/example\.com\/generated-\d+\.png$/);
    expect(post?.storyImageUrl).toMatch(/^https:\/\/example\.com\/stories-\d+\.png$/);
    expect(post?.caption).toBe("Hello!");
    expect(post?.scheduledFor?.toISOString()).toBe(scheduledFor.toISOString());

    // Sanity check the fixture actually reflects an approved profile.
    expect(await getBrandCreativeProfile(org.id)).not.toBeNull();
  });

  it("uses the first theme for an org's very first post", async () => {
    const org = await setUpReadyOrg();

    await generateAndScheduleContent({
      organizationId: org.id,
      platform: "INSTAGRAM",
      scheduledFor: new Date(),
    });

    const prompt = String(generateImageMock.mock.calls[0]![0].prompt);
    expect(prompt).toContain(CONTENT_THEMES[0]);
  });

  it("picks a different theme based on how many posts already exist, instead of always the first (the reported 'two posts looked the same' bug)", async () => {
    const org = await setUpReadyOrg();
    // Two prior posts already exist for this org.
    await prisma.contentPost.createMany({
      data: [
        {
          organizationId: org.id,
          platform: "INSTAGRAM",
          type: "POST",
          status: "PUBLISHED",
          imageUrls: ["https://example.com/x.png"],
        },
        {
          organizationId: org.id,
          platform: "INSTAGRAM",
          type: "POST",
          status: "PUBLISHED",
          imageUrls: ["https://example.com/y.png"],
        },
      ],
    });

    // Neither the immediate-add-a-slot path nor the one-time-post path
    // pass an explicit themeIndex - this call doesn't either, matching
    // those real call sites.
    await generateAndScheduleContent({
      organizationId: org.id,
      platform: "INSTAGRAM",
      scheduledFor: new Date(),
    });

    const prompt = String(generateImageMock.mock.calls[0]![0].prompt);
    expect(prompt).toContain(CONTENT_THEMES[2]);
    expect(prompt).not.toContain(CONTENT_THEMES[0]);
  });

  it("respects an explicitly-passed themeIndex over the post count (the cron job's own cycling)", async () => {
    const org = await setUpReadyOrg();

    await generateAndScheduleContent({
      organizationId: org.id,
      platform: "INSTAGRAM",
      scheduledFor: new Date(),
      themeIndex: 4,
    });

    const prompt = String(generateImageMock.mock.calls[0]![0].prompt);
    expect(prompt).toContain(CONTENT_THEMES[4]);
  });

  it("requests the 1024x1536 size, closest to Instagram's 1080x1350 post ratio", async () => {
    const org = await setUpReadyOrg();

    await generateAndScheduleContent({
      organizationId: org.id,
      platform: "INSTAGRAM",
      scheduledFor: new Date(),
    });

    expect(generateImageMock.mock.calls[0]![0].size).toBe("1024x1536");
  });

  describe("one AI image per organization per calendar day (client's explicit cost rule)", () => {
    it("reuses the same day's image for a second post on a different platform, instead of generating again", async () => {
      const org = await setUpReadyOrg();
      // Both land on the same UTC calendar day (org's timezone defaults to UTC).
      const morning = new Date("2026-09-15T09:00:00Z");
      const evening = new Date("2026-09-15T18:00:00Z");

      await generateAndScheduleContent({
        organizationId: org.id,
        platform: "INSTAGRAM",
        scheduledFor: morning,
      });
      await generateAndScheduleContent({
        organizationId: org.id,
        platform: "FACEBOOK",
        scheduledFor: evening,
      });

      // Only the first call should have actually generated an image.
      expect(generateImageMock).toHaveBeenCalledTimes(1);

      const posts = await prisma.contentPost.findMany({
        where: { organizationId: org.id },
        orderBy: { scheduledFor: "asc" },
      });
      expect(posts).toHaveLength(2);
      expect(posts[0]!.imageUrls[0]).toBe(posts[1]!.imageUrls[0]);
      expect(posts[0]!.storyImageUrl).toBe(posts[1]!.storyImageUrl);
      // Captions can still differ - only the image is shared.
      expect(generateCaptionMock).toHaveBeenCalledTimes(2);
    });

    it("reuses the same day's image for a second post at a different time, same platform", async () => {
      const org = await setUpReadyOrg();

      await generateAndScheduleContent({
        organizationId: org.id,
        platform: "INSTAGRAM",
        scheduledFor: new Date("2026-09-15T09:00:00Z"),
      });
      await generateAndScheduleContent({
        organizationId: org.id,
        platform: "INSTAGRAM",
        scheduledFor: new Date("2026-09-15T13:00:00Z"),
      });

      expect(generateImageMock).toHaveBeenCalledTimes(1);
    });

    it("generates a fresh image for a post scheduled on a different calendar day", async () => {
      const org = await setUpReadyOrg();

      await generateAndScheduleContent({
        organizationId: org.id,
        platform: "INSTAGRAM",
        scheduledFor: new Date("2026-09-15T09:00:00Z"),
      });
      await generateAndScheduleContent({
        organizationId: org.id,
        platform: "INSTAGRAM",
        scheduledFor: new Date("2026-09-16T09:00:00Z"),
      });

      expect(generateImageMock).toHaveBeenCalledTimes(2);
      const posts = await prisma.contentPost.findMany({
        where: { organizationId: org.id },
        orderBy: { scheduledFor: "asc" },
      });
      expect(posts[0]!.imageUrls[0]).not.toBe(posts[1]!.imageUrls[0]);
    });

    it("respects the organization's own timezone when deciding what counts as 'the same day'", async () => {
      const org = await setUpReadyOrg();
      await prisma.publishingSchedule.update({
        where: { organizationId: org.id },
        data: { timezone: "Asia/Karachi" }, // UTC+5
      });

      // Both instants fall on the same UTC calendar day (Sept 15), but
      // 21:00 UTC is already 2:00 AM Sept 16 in Karachi - a naive
      // UTC-day check would wrongly treat these as the same day and
      // reuse the image; the org's actual (Karachi) day should not.
      await generateAndScheduleContent({
        organizationId: org.id,
        platform: "INSTAGRAM",
        scheduledFor: new Date("2026-09-15T18:00:00Z"), // 23:00 Karachi, Sept 15
      });
      await generateAndScheduleContent({
        organizationId: org.id,
        platform: "FACEBOOK",
        scheduledFor: new Date("2026-09-15T21:00:00Z"), // 02:00 Karachi, Sept 16
      });

      expect(generateImageMock).toHaveBeenCalledTimes(2);
    });
  });
});
