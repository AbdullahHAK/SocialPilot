import { prisma, upsertBrandProfile } from "@socialpilot/db";
import { afterEach, describe, expect, it } from "vitest";
import { runMaterializeCycle } from "./materializer";

afterEach(async () => {
  await prisma.organization.deleteMany();
});

async function setUpReadyOrgWithSlots(
  slots: { dayOfWeek: string; time: string; platform: "INSTAGRAM" | "FACEBOOK" }[],
) {
  const org = await prisma.organization.create({
    data: {
      name: "Acme",
      publishingSchedule: {
        create: {
          slots: { create: slots.map((s) => ({ ...s, dayOfWeek: s.dayOfWeek as never })) },
        },
      },
    },
  });
  await upsertBrandProfile({
    organizationId: org.id,
    businessName: "Acme",
    language: "en",
    logoUrl: "https://example.com/logo.png",
  });
  await prisma.brandCreativeProfile.create({
    data: { organizationId: org.id, promptTemplateAdditions: "on-brand content" },
  });
  return org;
}

describe("runMaterializeCycle", () => {
  it("creates a PENDING job for an org's upcoming slot occurrence", async () => {
    await setUpReadyOrgWithSlots([{ dayOfWeek: "MONDAY", time: "18:00", platform: "INSTAGRAM" }]);

    await runMaterializeCycle(new Date("2026-09-14T00:00:00Z")); // a Monday

    const jobs = await prisma.contentJob.findMany();
    expect(jobs).toHaveLength(1);
    expect(jobs[0]!.status).toBe("PENDING");
    expect(jobs[0]!.origin).toBe("SLOT");
    expect(jobs[0]!.platforms).toEqual(["INSTAGRAM"]);
  });

  it("collapses two slots landing on the exact same instant into one job (no duplicate jobs for one scheduled time)", async () => {
    await setUpReadyOrgWithSlots([
      { dayOfWeek: "MONDAY", time: "18:00", platform: "INSTAGRAM" },
      { dayOfWeek: "MONDAY", time: "18:00", platform: "FACEBOOK" },
    ]);

    await runMaterializeCycle(new Date("2026-09-14T00:00:00Z"));

    const jobs = await prisma.contentJob.findMany();
    expect(jobs).toHaveLength(1);
    expect(jobs[0]!.platforms.sort()).toEqual(["FACEBOOK", "INSTAGRAM"]);
  });

  it("skips an org with no enabled slots", async () => {
    const org = await prisma.organization.create({
      data: { name: "Acme", publishingSchedule: { create: {} } },
    });
    await upsertBrandProfile({
      organizationId: org.id,
      businessName: "Acme",
      language: "en",
      logoUrl: "https://example.com/logo.png",
    });
    await prisma.brandCreativeProfile.create({
      data: { organizationId: org.id, promptTemplateAdditions: "content" },
    });

    await runMaterializeCycle(new Date("2026-09-14T00:00:00Z"));

    expect(await prisma.contentJob.count()).toBe(0);
  });

  it("still materializes a job even before brand setup is complete - the generation cycle re-checks readiness and cancels it later if needed", async () => {
    await prisma.organization.create({
      data: {
        name: "Acme",
        publishingSchedule: {
          create: { slots: { create: { dayOfWeek: "MONDAY", time: "18:00", platform: "INSTAGRAM" } } },
        },
      },
    });

    await runMaterializeCycle(new Date("2026-09-14T00:00:00Z"));

    expect(await prisma.contentJob.count()).toBe(1);
  });

  it("reconciles: removes a materialized job once its slot is deleted", async () => {
    const org = await setUpReadyOrgWithSlots([
      { dayOfWeek: "MONDAY", time: "18:00", platform: "INSTAGRAM" },
    ]);
    await runMaterializeCycle(new Date("2026-09-14T00:00:00Z"));
    expect(await prisma.contentJob.count()).toBe(1);

    await prisma.scheduleSlot.deleteMany({
      where: { publishingSchedule: { organizationId: org.id } },
    });

    await runMaterializeCycle(new Date("2026-09-14T00:00:00Z"));
    expect(await prisma.contentJob.count()).toBe(0);
  });
});
