import { afterEach, describe, expect, it } from "vitest";
import { createCreativeConcept } from "./creative-concept";
import { prisma } from "./index";
import { getMonthlyImageUsage } from "./usage";

afterEach(async () => {
  await prisma.organization.deleteMany();
});

/** A job that triggered a fresh generation (creativeMetadata + generatedAt
 * both set, mirroring markContentJobGenerated's fresh-generation branch) -
 * pass `fresh: false` to simulate a same-day-reused job instead (neither
 * field set, costs nothing extra, must not count toward usage). */
async function makeGeneratedJob(
  organizationId: string,
  options: { fresh?: boolean; generatedAt?: Date } = {},
) {
  const fresh = options.fresh ?? true;
  return prisma.contentJob.create({
    data: {
      organizationId,
      scheduledFor: new Date(),
      platforms: ["INSTAGRAM"],
      status: "READY",
      masterImageUrl: "https://example.com/a.png",
      creativeMetadata: fresh ? { subject: "x" } : undefined,
      generatedAt: fresh ? (options.generatedAt ?? new Date()) : undefined,
    },
  });
}

describe("getMonthlyImageUsage", () => {
  it("counts freshly-generated content jobs, brand style concepts, and logo concepts separately, and sums them for total", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    await makeGeneratedJob(org.id);
    await makeGeneratedJob(org.id);
    await createCreativeConcept({
      organizationId: org.id,
      brief: "Brief",
      imageUrls: ["https://example.com/1.png"],
      kind: "BRAND_STYLE",
    });
    await createCreativeConcept({
      organizationId: org.id,
      brief: "[logo]",
      imageUrls: ["https://example.com/2.png"],
      kind: "LOGO",
    });
    await createCreativeConcept({
      organizationId: org.id,
      brief: "[logo]",
      imageUrls: ["https://example.com/3.png"],
      kind: "LOGO",
    });

    const usage = await getMonthlyImageUsage(org.id);

    expect(usage.brandStyle).toBe(1);
    expect(usage.logo).toBe(2);
    expect(usage.total).toBe(5);
  });

  it("does not count a same-day-reused content job (no fresh generatedAt/creativeMetadata)", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    await makeGeneratedJob(org.id, { fresh: true });
    await makeGeneratedJob(org.id, { fresh: false });

    const usage = await getMonthlyImageUsage(org.id);

    expect(usage.total).toBe(1);
  });

  it("only counts generations within the current calendar month", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    const now = new Date("2026-09-15T12:00:00Z");
    const lastMonth = new Date("2026-08-20T12:00:00Z");

    await makeGeneratedJob(org.id, { generatedAt: now });
    await makeGeneratedJob(org.id, { generatedAt: lastMonth });

    const usage = await getMonthlyImageUsage(org.id, now);

    expect(usage.total).toBe(1);
  });

  it("only counts organization's own usage", async () => {
    const orgA = await prisma.organization.create({ data: { name: "A" } });
    const orgB = await prisma.organization.create({ data: { name: "B" } });
    await makeGeneratedJob(orgA.id);
    await makeGeneratedJob(orgB.id);
    await makeGeneratedJob(orgB.id);

    expect((await getMonthlyImageUsage(orgA.id)).total).toBe(1);
    expect((await getMonthlyImageUsage(orgB.id)).total).toBe(2);
  });

  it("returns all zeros for an organization with no usage", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });

    expect(await getMonthlyImageUsage(org.id)).toEqual({ total: 0, brandStyle: 0, logo: 0 });
  });
});
