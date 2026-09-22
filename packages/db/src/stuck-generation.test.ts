import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "./index";
import { releaseStuckGeneratingJobs } from "./content-job";

afterEach(async () => {
  await prisma.organization.deleteMany();
});

const NOW = new Date("2026-09-21T12:00:00Z");
const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000);

const OPTIONS = { stuckAfterMinutes: 15, maxLateMinutes: 60, maxAttempts: 3 };

async function makeOrg() {
  return prisma.organization.create({ data: { name: "Acme" } });
}

async function makeStuckJob(
  organizationId: string,
  overrides: { scheduledFor?: Date; lastAttemptAt?: Date | null; attempts?: number } = {},
) {
  return prisma.contentJob.create({
    data: {
      organizationId,
      scheduledFor: overrides.scheduledFor ?? minutesAgo(20),
      platforms: ["INSTAGRAM"],
      status: "GENERATING",
      attempts: overrides.attempts ?? 0,
      lastAttemptAt: overrides.lastAttemptAt === undefined ? minutesAgo(20) : overrides.lastAttemptAt,
    },
  });
}

describe("releaseStuckGeneratingJobs", () => {
  it("retries a job abandoned mid-generation, whose slot is still recent", async () => {
    const org = await makeOrg();
    const job = await makeStuckJob(org.id, { scheduledFor: minutesAgo(20) });

    const released = await releaseStuckGeneratingJobs(NOW, OPTIONS);

    expect(released).toEqual({ retried: 1, failed: 0, cancelled: 0 });
    const updated = await prisma.contentJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(updated.status).toBe("RETRYING");
    expect(updated.attempts).toBe(1);
  });

  it("never touches a job still within its normal generation time", async () => {
    const org = await makeOrg();
    await makeStuckJob(org.id, { lastAttemptAt: minutesAgo(5) });

    expect(await releaseStuckGeneratingJobs(NOW, OPTIONS)).toEqual({ retried: 0, failed: 0, cancelled: 0 });
  });

  it("never touches a job that isn't GENERATING", async () => {
    const org = await makeOrg();
    await prisma.contentJob.create({
      data: {
        organizationId: org.id,
        scheduledFor: minutesAgo(20),
        platforms: ["INSTAGRAM"],
        status: "PENDING",
        lastAttemptAt: minutesAgo(20),
      },
    });

    expect(await releaseStuckGeneratingJobs(NOW, OPTIONS)).toEqual({ retried: 0, failed: 0, cancelled: 0 });
  });

  it("cancels rather than retries once the scheduled slot is too far past to still be worth publishing", async () => {
    const org = await makeOrg();
    const job = await makeStuckJob(org.id, { scheduledFor: minutesAgo(90) });

    const released = await releaseStuckGeneratingJobs(NOW, OPTIONS);

    expect(released).toEqual({ retried: 0, failed: 0, cancelled: 1 });
    const updated = await prisma.contentJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(updated.status).toBe("CANCELLED");
    expect(updated.errorMessage).toMatch(/scheduled time had already passed/i);
  });

  it("fails permanently rather than retrying forever once attempts are exhausted", async () => {
    const org = await makeOrg();
    const job = await makeStuckJob(org.id, { attempts: 2 });

    const released = await releaseStuckGeneratingJobs(NOW, OPTIONS);

    expect(released).toEqual({ retried: 0, failed: 1, cancelled: 0 });
    const updated = await prisma.contentJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(updated.status).toBe("FAILED");
    expect(updated.attempts).toBe(3);
  });

  it("treats a job that never recorded any attempt as stuck too", async () => {
    const org = await makeOrg();
    const job = await makeStuckJob(org.id, { lastAttemptAt: null });

    const released = await releaseStuckGeneratingJobs(NOW, OPTIONS);

    expect(released.retried).toBe(1);
    expect((await prisma.contentJob.findUniqueOrThrow({ where: { id: job.id } })).status).toBe("RETRYING");
  });

  it("does not release a job that finished generating between being read and being updated", async () => {
    const org = await makeOrg();
    const job = await makeStuckJob(org.id);
    // Simulates the real generation finishing (and moving on to READY)
    // in the narrow window after this sweep's own SELECT already ran.
    await prisma.contentJob.update({
      where: { id: job.id },
      data: { status: "READY", lastAttemptAt: minutesAgo(1), masterImageUrl: "https://example.com/a.png" },
    });

    // A fresh call re-reads current state, so nothing stale is at risk -
    // this asserts the READY job is simply not a candidate at all.
    expect(await releaseStuckGeneratingJobs(NOW, OPTIONS)).toEqual({ retried: 0, failed: 0, cancelled: 0 });
    expect((await prisma.contentJob.findUniqueOrThrow({ where: { id: job.id } })).status).toBe("READY");
  });

  it("handles many stuck jobs across businesses in one sweep", async () => {
    const orgA = await makeOrg();
    const orgB = await makeOrg();
    await makeStuckJob(orgA.id, { scheduledFor: minutesAgo(20) });
    await makeStuckJob(orgA.id, { scheduledFor: minutesAgo(90) });
    await makeStuckJob(orgB.id, { attempts: 2 });

    const released = await releaseStuckGeneratingJobs(NOW, OPTIONS);

    expect(released).toEqual({ retried: 1, failed: 1, cancelled: 1 });
  });
});
