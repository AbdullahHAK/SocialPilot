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

vi.mock("./storage", () => ({
  uploadGeneratedImage: vi
    .fn()
    .mockImplementation((_orgId: string, _buffer: Buffer, prefix = "generated") =>
      Promise.resolve(`https://example.com/${prefix}.png`),
    ),
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
});

async function setUpReadyOrg(name = "Acme") {
  const org = await prisma.organization.create({ data: { name } });
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
    expect(post?.imageUrls).toEqual(["https://example.com/generated.png"]);
    expect(post?.storyImageUrl).toBe("https://example.com/stories.png");
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
});
