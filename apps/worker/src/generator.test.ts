import { prisma, upsertBrandProfile } from "@socialpilot/db";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GENERATION_LEAD_MINUTES, MAX_GENERATION_ATTEMPTS, runGenerationCycle } from "./generator";

const generateContentForJobMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@socialpilot/content-engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@socialpilot/content-engine")>();
  return {
    ...actual,
    generateContentForJob: (...args: unknown[]) => generateContentForJobMock(...args),
  };
});

afterEach(async () => {
  await prisma.organization.deleteMany();
  generateContentForJobMock.mockClear();
  generateContentForJobMock.mockResolvedValue(undefined);
});

async function setUpReadyOrg(name = "Acme") {
  const org = await prisma.organization.create({ data: { name, publishingSchedule: { create: {} } } });
  await upsertBrandProfile({
    organizationId: org.id,
    businessName: name,
    language: "en",
    logoUrl: "https://example.com/logo.png",
  });
  await prisma.brandCreativeProfile.create({
    data: { organizationId: org.id, promptTemplateAdditions: "content" },
  });
  await prisma.subscription.create({ data: { organizationId: org.id, status: "ACTIVE" } });
  return org;
}

async function createJob(organizationId: string, scheduledFor: Date) {
  return prisma.contentJob.create({
    data: {
      organizationId,
      scheduledFor,
      platforms: ["INSTAGRAM"],
      origin: "ONE_TIME",
      publications: { create: [{ platform: "INSTAGRAM" }] },
    },
  });
}

describe("runGenerationCycle", () => {
  it("generates a job due within the lead-time window", async () => {
    const org = await setUpReadyOrg();
    const now = new Date("2026-09-15T12:00:00Z");
    const job = await createJob(org.id, new Date(now.getTime() + (GENERATION_LEAD_MINUTES - 1) * 60_000));

    await runGenerationCycle(now);

    expect(generateContentForJobMock).toHaveBeenCalledTimes(1);
    expect(generateContentForJobMock.mock.calls[0]![0].id).toBe(job.id);
  });

  it("still generates when the org has no subscription row at all (billing isn't enforced yet - real production incident)", async () => {
    // Confirmed in production: every real account, including the paying
    // client's, has no Subscription row (never run through Stripe
    // checkout) - nothing else in the app gates on subscription status
    // either, so requiring an ACTIVE/TRIALING row here cancelled every
    // real customer's scheduled content the first time this shipped.
    const org = await prisma.organization.create({ data: { name: "Acme", publishingSchedule: { create: {} } } });
    await upsertBrandProfile({
      organizationId: org.id,
      businessName: "Acme",
      language: "en",
      logoUrl: "https://example.com/logo.png",
    });
    await prisma.brandCreativeProfile.create({
      data: { organizationId: org.id, promptTemplateAdditions: "content" },
    });
    const now = new Date("2026-09-15T12:00:00Z");
    const job = await createJob(org.id, new Date(now.getTime() + 60_000));

    await runGenerationCycle(now);

    expect(generateContentForJobMock).toHaveBeenCalledTimes(1);
    const updated = await prisma.contentJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(updated.status).not.toBe("CANCELLED");
  });

  it.each(["INCOMPLETE", "PAST_DUE", "TRIALING"] as const)(
    "still generates when the subscription status is %s (only an explicit CANCELED blocks)",
    async (status) => {
      const org = await setUpReadyOrg();
      await prisma.subscription.update({ where: { organizationId: org.id }, data: { status } });
      const now = new Date("2026-09-15T12:00:00Z");
      await createJob(org.id, new Date(now.getTime() + 60_000));

      await runGenerationCycle(now);

      expect(generateContentForJobMock).toHaveBeenCalledTimes(1);
    },
  );

  it("does not generate a job that's still days away", async () => {
    const org = await setUpReadyOrg();
    const now = new Date("2026-09-15T12:00:00Z");
    await createJob(org.id, new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000));

    await runGenerationCycle(now);

    expect(generateContentForJobMock).not.toHaveBeenCalled();
  });

  it("cancels rather than generates when the subscription is no longer active", async () => {
    const org = await setUpReadyOrg();
    await prisma.subscription.update({ where: { organizationId: org.id }, data: { status: "CANCELED" } });
    const now = new Date("2026-09-15T12:00:00Z");
    const job = await createJob(org.id, new Date(now.getTime() + 60_000));

    await runGenerationCycle(now);

    expect(generateContentForJobMock).not.toHaveBeenCalled();
    const updated = await prisma.contentJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(updated.status).toBe("CANCELLED");
    expect(updated.errorMessage).toMatch(/subscription/i);
  });

  it("cancels rather than generates when brand setup is no longer complete", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme", publishingSchedule: { create: {} } } });
    await prisma.subscription.create({ data: { organizationId: org.id, status: "ACTIVE" } });
    const now = new Date("2026-09-15T12:00:00Z");
    const job = await createJob(org.id, new Date(now.getTime() + 60_000));

    await runGenerationCycle(now);

    expect(generateContentForJobMock).not.toHaveBeenCalled();
    const updated = await prisma.contentJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(updated.status).toBe("CANCELLED");
    expect(updated.errorMessage).toMatch(/brand setup/i);
  });

  it("retries on generation failure, then permanently fails once attempts are exhausted", async () => {
    const org = await setUpReadyOrg();
    const now = new Date("2026-09-15T12:00:00Z");
    const job = await createJob(org.id, new Date(now.getTime() + 60_000));
    generateContentForJobMock.mockRejectedValue(new Error("OpenAI is down"));

    for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt++) {
      // Reset to PENDING/RETRYING is handled by markContentJobGenerationFailed
      // itself; re-run the cycle to simulate the next poll.
      await runGenerationCycle(now);
    }

    const updated = await prisma.contentJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(updated.status).toBe("FAILED");
    expect(updated.attempts).toBe(MAX_GENERATION_ATTEMPTS);
    expect(generateContentForJobMock).toHaveBeenCalledTimes(MAX_GENERATION_ATTEMPTS);
  });

  it("cancels a job whose scheduled time passed long before it was ever generated (extended downtime)", async () => {
    const org = await setUpReadyOrg();
    const now = new Date("2026-09-15T12:00:00Z");
    const job = await createJob(org.id, new Date(now.getTime() - 48 * 60 * 60 * 1000));

    await runGenerationCycle(now);

    expect(generateContentForJobMock).not.toHaveBeenCalled();
    const updated = await prisma.contentJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(updated.status).toBe("CANCELLED");
  });

  describe("race-condition protection", () => {
    it("only one of two concurrent generation cycles generates the same job", async () => {
      const org = await setUpReadyOrg();
      const now = new Date("2026-09-15T12:00:00Z");
      const job = await createJob(org.id, new Date(now.getTime() + 60_000));
      // Simulate real work taking a moment, so both cycles' claim attempts
      // genuinely overlap rather than the first finishing instantly.
      generateContentForJobMock.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 30)),
      );

      await Promise.all([runGenerationCycle(now), runGenerationCycle(now)]);

      expect(generateContentForJobMock).toHaveBeenCalledTimes(1);
      const updated = await prisma.contentJob.findUniqueOrThrow({ where: { id: job.id } });
      expect(updated.status).toBe("GENERATING");
    });
  });
});
