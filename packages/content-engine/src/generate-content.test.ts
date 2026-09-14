import {
  getBrandCreativeProfile,
  materializeContentJob,
  prisma,
  upsertBrandProfile,
} from "@socialpilot/db";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CAMERA_ANGLES,
  CONTENT_THEMES,
  ENVIRONMENTS,
  generateContentForJob,
  SUBJECTS,
} from "./generate-content";

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

const fetchImageBufferMock = vi.fn().mockResolvedValue(TINY_PNG);
vi.mock("./fetch-image", () => ({
  fetchImageBuffer: (...args: unknown[]) => fetchImageBufferMock(...args),
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
  fetchImageBufferMock.mockClear();
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

async function makeJob(
  organizationId: string,
  scheduledFor: Date,
  platforms: ("INSTAGRAM" | "FACEBOOK")[] = ["INSTAGRAM"],
) {
  return materializeContentJob({ organizationId, scheduledFor, platforms, origin: "ONE_TIME" });
}

describe("generateContentForJob", () => {
  it("throws when the brand isn't ready (caller is responsible for not calling this in that case)", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme", publishingSchedule: { create: {} } } });
    await upsertBrandProfile({ organizationId: org.id, businessName: "Acme", language: "en" });
    const job = await makeJob(org.id, new Date());

    await expect(generateContentForJob(job)).rejects.toThrow(/brand setup/i);
  });

  it("generates and marks the job READY, including a Story-format image, when the brand is ready", async () => {
    const org = await setUpReadyOrg();
    const scheduledFor = new Date("2026-09-15T09:00:00Z");
    const job = await makeJob(org.id, scheduledFor, ["FACEBOOK"]);

    await generateContentForJob(job);

    const updated = await prisma.contentJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(updated.status).toBe("READY");
    expect(updated.masterImageUrl).toMatch(/^https:\/\/example\.com\/generated-\d+\.png$/);
    expect(updated.storyImageUrl).toMatch(/^https:\/\/example\.com\/stories-\d+\.png$/);
    expect(updated.caption).toBe("Hello!");

    expect(await getBrandCreativeProfile(org.id)).not.toBeNull();
  });

  it("uses the first theme for an org's very first generated job", async () => {
    const org = await setUpReadyOrg();
    const job = await makeJob(org.id, new Date());

    await generateContentForJob(job);

    const prompt = String(generateImageMock.mock.calls[0]![0].prompt);
    expect(prompt).toContain(CONTENT_THEMES[0]);
  });

  it("picks a different theme based on how many jobs have already been generated", async () => {
    const org = await setUpReadyOrg();
    const jobA = await makeJob(org.id, new Date("2026-09-15T09:00:00Z"));
    await generateContentForJob(jobA);
    const jobB = await makeJob(org.id, new Date("2026-09-16T09:00:00Z"));

    await generateContentForJob(jobB);

    const prompt = String(generateImageMock.mock.calls[1]![0].prompt);
    expect(prompt).toContain(CONTENT_THEMES[1]);
  });

  it("doesn't request a specific size, so the post goes out exactly as the model made it, uncropped", async () => {
    const org = await setUpReadyOrg();
    const job = await makeJob(org.id, new Date());

    await generateContentForJob(job);

    expect(generateImageMock.mock.calls[0]![0].size).toBeUndefined();
  });

  describe("one shared creative per job, across every selected platform (client's core fix)", () => {
    it("a job spanning both platforms produces exactly one image and one caption", async () => {
      const org = await setUpReadyOrg();
      const job = await makeJob(org.id, new Date(), ["INSTAGRAM", "FACEBOOK"]);

      await generateContentForJob(job);

      expect(generateImageMock).toHaveBeenCalledTimes(1);
      expect(generateCaptionMock).toHaveBeenCalledTimes(1);
      const updated = await prisma.contentJob.findUniqueOrThrow({ where: { id: job.id } });
      expect(updated.masterImageUrl).not.toBeNull();
      // Both platforms' publications will publish this same job - nothing
      // platform-specific was ever generated.
      const publications = await prisma.contentPublication.findMany({
        where: { contentJobId: job.id },
      });
      expect(publications.map((p) => p.platform).sort()).toEqual(["FACEBOOK", "INSTAGRAM"]);
    });
  });

  describe("creative diversity (client's explicit fix for repetitive-looking posts)", () => {
    it("does not pass the approved concept image as a reference - only the logo", async () => {
      const org = await setUpReadyOrg();
      const job = await makeJob(org.id, new Date());

      await generateContentForJob(job);

      const referenceImages = generateImageMock.mock.calls[0]![0].referenceImages;
      expect(referenceImages).toHaveLength(1);
    });

    it("stores creative metadata describing the resolved variation for a freshly generated image", async () => {
      const org = await setUpReadyOrg();
      const job = await makeJob(org.id, new Date());

      await generateContentForJob(job);

      const updated = await prisma.contentJob.findUniqueOrThrow({ where: { id: job.id } });
      const metadata = updated.creativeMetadata as Record<string, string> | null;
      expect(metadata).not.toBeNull();
      expect(metadata!.subject).toBe(SUBJECTS[0]);
      expect(metadata!.cameraAngle).toBe(CAMERA_ANGLES[0]);
      expect(metadata!.environment).toBe(ENVIRONMENTS[0]);
      expect(metadata!.language).toBe("en");
    });

    it("includes the approved style profile as text guidance, not the image itself", async () => {
      const org = await setUpReadyOrg();
      await prisma.brandCreativeProfile.update({
        where: { organizationId: org.id },
        data: {
          styleDescriptors: {
            colors: ["deep red", "cream"],
            typographyDirection: "",
            logoUsage: "",
            photographyStyle: "warm, rustic food photography",
            lightingStyle: "",
            visualQuality: "",
            brandPersonality: "cozy and inviting",
            designAesthetic: "",
          },
        },
      });
      const job = await makeJob(org.id, new Date());

      await generateContentForJob(job);

      const prompt = String(generateImageMock.mock.calls[0]![0].prompt);
      expect(prompt).toContain("warm, rustic food photography");
      expect(prompt).toContain("cozy and inviting");
      expect(prompt).toContain("completely new visual concept");
    });

    it("tells the model not to repeat the most recent jobs' actual creative choices", async () => {
      const org = await setUpReadyOrg();
      const jobA = await makeJob(org.id, new Date("2026-09-15T09:00:00Z"));
      await generateContentForJob(jobA);
      const jobB = await makeJob(org.id, new Date("2026-09-16T09:00:00Z"));

      await generateContentForJob(jobB);

      const secondPrompt = String(generateImageMock.mock.calls[1]![0].prompt);
      expect(secondPrompt).toContain("Do not repeat");
      expect(secondPrompt).toContain(SUBJECTS[0]);
    });
  });

  describe("one AI image per organization per calendar day (client's explicit cost rule, re-scoped to jobs)", () => {
    it("reuses the same day's image for a second job, instead of generating again", async () => {
      const org = await setUpReadyOrg();
      const jobA = await makeJob(org.id, new Date("2026-09-15T09:00:00Z"), ["INSTAGRAM"]);
      const jobB = await makeJob(org.id, new Date("2026-09-15T18:00:00Z"), ["FACEBOOK"]);

      await generateContentForJob(jobA);
      await generateContentForJob(jobB);

      expect(generateImageMock).toHaveBeenCalledTimes(1);
      const [a, b] = await Promise.all([
        prisma.contentJob.findUniqueOrThrow({ where: { id: jobA.id } }),
        prisma.contentJob.findUniqueOrThrow({ where: { id: jobB.id } }),
      ]);
      expect(a.masterImageUrl).toBe(b.masterImageUrl);
      expect(a.storyImageUrl).toBe(b.storyImageUrl);
      // Captions can still differ - only the image is shared.
      expect(generateCaptionMock).toHaveBeenCalledTimes(2);
    });

    it("does not generate twice when two jobs for the same day race each other (production incident, re-scoped to jobs)", async () => {
      const org = await setUpReadyOrg();
      const jobA = await makeJob(org.id, new Date("2026-09-15T09:00:00Z"), ["INSTAGRAM"]);
      const jobB = await makeJob(org.id, new Date("2026-09-15T13:00:00Z"), ["FACEBOOK"]);

      await Promise.all([generateContentForJob(jobA), generateContentForJob(jobB)]);

      expect(generateImageMock).toHaveBeenCalledTimes(1);
      const [a, b] = await Promise.all([
        prisma.contentJob.findUniqueOrThrow({ where: { id: jobA.id } }),
        prisma.contentJob.findUniqueOrThrow({ where: { id: jobB.id } }),
      ]);
      expect(a.masterImageUrl).toBe(b.masterImageUrl);
    });

    it("generates a fresh image for a job scheduled on a different calendar day", async () => {
      const org = await setUpReadyOrg();
      const jobA = await makeJob(org.id, new Date("2026-09-15T09:00:00Z"));
      const jobB = await makeJob(org.id, new Date("2026-09-16T09:00:00Z"));

      await generateContentForJob(jobA);
      await generateContentForJob(jobB);

      expect(generateImageMock).toHaveBeenCalledTimes(2);
      const [a, b] = await Promise.all([
        prisma.contentJob.findUniqueOrThrow({ where: { id: jobA.id } }),
        prisma.contentJob.findUniqueOrThrow({ where: { id: jobB.id } }),
      ]);
      expect(a.masterImageUrl).not.toBe(b.masterImageUrl);
    });

    it("respects the organization's own timezone when deciding what counts as 'the same day'", async () => {
      const org = await setUpReadyOrg();
      await prisma.publishingSchedule.update({
        where: { organizationId: org.id },
        data: { timezone: "Asia/Karachi" }, // UTC+5
      });
      const jobA = await makeJob(org.id, new Date("2026-09-15T18:00:00Z")); // 23:00 Karachi, Sept 15
      const jobB = await makeJob(org.id, new Date("2026-09-15T21:00:00Z")); // 02:00 Karachi, Sept 16

      await generateContentForJob(jobA);
      await generateContentForJob(jobB);

      expect(generateImageMock).toHaveBeenCalledTimes(2);
    });

    it("does not reuse the day's image if the brand profile was corrected after it was generated", async () => {
      const org = await setUpReadyOrg();
      const jobA = await makeJob(org.id, new Date("2026-09-15T09:00:00Z"));
      await generateContentForJob(jobA);

      await upsertBrandProfile({
        organizationId: org.id,
        businessName: "The Real Business",
        language: "en",
        logoUrl: "https://example.com/logo.png",
      });
      const jobB = await makeJob(org.id, new Date("2026-09-15T18:00:00Z"));

      await generateContentForJob(jobB);

      expect(generateImageMock).toHaveBeenCalledTimes(2);
      const [a, b] = await Promise.all([
        prisma.contentJob.findUniqueOrThrow({ where: { id: jobA.id } }),
        prisma.contentJob.findUniqueOrThrow({ where: { id: jobB.id } }),
      ]);
      expect(a.masterImageUrl).not.toBe(b.masterImageUrl);
    });

    it("reuses a later, valid image instead of regenerating forever once one stale job exists earlier that day (production incident)", async () => {
      const org = await setUpReadyOrg();
      const jobA = await makeJob(org.id, new Date("2026-09-15T09:00:00Z"));
      await generateContentForJob(jobA);

      await upsertBrandProfile({
        organizationId: org.id,
        businessName: "The Real Business",
        language: "en",
        logoUrl: "https://example.com/logo.png",
      });
      const jobB = await makeJob(org.id, new Date("2026-09-15T13:00:00Z"));
      await generateContentForJob(jobB);

      const jobC = await makeJob(org.id, new Date("2026-09-15T18:00:00Z"));
      await generateContentForJob(jobC);

      expect(generateImageMock).toHaveBeenCalledTimes(2);
      const [a, b, c] = await Promise.all([
        prisma.contentJob.findUniqueOrThrow({ where: { id: jobA.id } }),
        prisma.contentJob.findUniqueOrThrow({ where: { id: jobB.id } }),
        prisma.contentJob.findUniqueOrThrow({ where: { id: jobC.id } }),
      ]);
      expect(a.masterImageUrl).not.toBe(b.masterImageUrl);
      expect(c.masterImageUrl).toBe(b.masterImageUrl);
    });
  });
});
