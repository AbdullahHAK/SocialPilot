import { getBrandCreativeProfile, prisma, upsertBrandProfile } from "@socialpilot/db";
import { afterEach, describe, expect, it, vi } from "vitest";
import { generateAndScheduleContent } from "./generate-content";

vi.mock("./storage", () => ({
  uploadGeneratedImage: vi.fn().mockResolvedValue("https://example.com/generated.png"),
}));

afterEach(async () => {
  await prisma.organization.deleteMany();
  vi.unstubAllGlobals();
});

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

  it("generates and schedules a post when the brand is ready", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    await upsertBrandProfile({
      organizationId: org.id,
      businessName: "Acme",
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

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url) => {
        const target = String(url);
        if (target.includes("/images/")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({ data: [{ b64_json: Buffer.from("fake-png").toString("base64") }] }),
              { status: 200 },
            ),
          );
        }
        return Promise.resolve(
          new Response(
            JSON.stringify({
              choices: [
                { message: { content: JSON.stringify({ caption: "Hello!", hashtags: ["promo"] }) } },
              ],
            }),
            { status: 200 },
          ),
        );
      }),
    );

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
    expect(post?.caption).toBe("Hello!");
    expect(post?.scheduledFor?.toISOString()).toBe(scheduledFor.toISOString());

    // Sanity check the fixture actually reflects an approved profile.
    expect(await getBrandCreativeProfile(org.id)).not.toBeNull();
  });
});
