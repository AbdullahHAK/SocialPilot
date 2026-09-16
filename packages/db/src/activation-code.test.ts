import { afterEach, describe, expect, it } from "vitest";
import {
  ActivationCodeInvalidError,
  generateActivationCodes,
  redeemActivationCode,
} from "./activation-code";
import { prisma } from "./index";

afterEach(async () => {
  await prisma.organization.deleteMany();
  await prisma.activationCode.deleteMany();
});

async function createOrg(name: string) {
  return prisma.organization.create({ data: { name } });
}

describe("generateActivationCodes", () => {
  it("creates the requested number of unique codes", async () => {
    const codes = await generateActivationCodes({
      count: 25,
      plan: "MONTHLY",
      durationDays: 30,
      createdByAdminId: "admin_1",
    });

    expect(codes).toHaveLength(25);
    expect(new Set(codes).size).toBe(25);
    for (const code of codes) {
      expect(code).toMatch(/^YOPA-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    }
  });
});

describe("redeemActivationCode", () => {
  it("activates a subscription with the correct plan and expiration", async () => {
    const org = await createOrg("Redeemer Co");
    const [code] = await generateActivationCodes({
      count: 1,
      plan: "SIX_MONTH",
      durationDays: 180,
      createdByAdminId: "admin_1",
    });

    const before = Date.now();
    const result = await redeemActivationCode(code!, org.id);
    const expectedEnd = before + 180 * 24 * 60 * 60 * 1000;

    expect(result.plan).toBe("SIX_MONTH");
    expect(Math.abs(result.currentPeriodEnd.getTime() - expectedEnd)).toBeLessThan(5000);

    const subscription = await prisma.subscription.findUnique({ where: { organizationId: org.id } });
    expect(subscription?.status).toBe("ACTIVE");
    expect(subscription?.plan).toBe("SIX_MONTH");
  });

  it("never redeems the same code twice, even racing concurrently", async () => {
    const orgA = await createOrg("Org A");
    const orgB = await createOrg("Org B");
    const [code] = await generateActivationCodes({
      count: 1,
      plan: "MONTHLY",
      durationDays: 30,
      createdByAdminId: "admin_1",
    });

    const results = await Promise.allSettled([
      redeemActivationCode(code!, orgA.id),
      redeemActivationCode(code!, orgB.id),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
      ActivationCodeInvalidError,
    );

    const record = await prisma.activationCode.findUnique({ where: { code: code! } });
    expect(record?.status).toBe("REDEEMED");
  });

  it("rejects an already-redeemed code", async () => {
    const org = await createOrg("Org C");
    const [code] = await generateActivationCodes({
      count: 1,
      plan: "MONTHLY",
      durationDays: 30,
      createdByAdminId: "admin_1",
    });
    await redeemActivationCode(code!, org.id);

    await expect(redeemActivationCode(code!, org.id)).rejects.toBeInstanceOf(
      ActivationCodeInvalidError,
    );
  });

  it("rejects an expired code", async () => {
    const org = await createOrg("Org D");
    const [code] = await generateActivationCodes({
      count: 1,
      plan: "MONTHLY",
      durationDays: 30,
      expiresAt: new Date(Date.now() - 1000),
      createdByAdminId: "admin_1",
    });

    await expect(redeemActivationCode(code!, org.id)).rejects.toBeInstanceOf(
      ActivationCodeInvalidError,
    );
  });

  it("rejects an unknown code", async () => {
    const org = await createOrg("Org E");
    await expect(redeemActivationCode("YOPA-0000-0000", org.id)).rejects.toBeInstanceOf(
      ActivationCodeInvalidError,
    );
  });
});
