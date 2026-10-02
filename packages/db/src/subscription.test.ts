import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "./index";
import {
  adjustSubscriptionDays,
  extendSubscriptionByDuration,
  getSubscription,
  isSubscriptionActive,
  manuallyActivateSubscription,
  setStripeCustomer,
  setSubscriptionExpiration,
  syncSubscriptionFromStripe,
} from "./subscription";

afterEach(async () => {
  await prisma.organization.deleteMany();
});

describe("setStripeCustomer", () => {
  it("creates a subscription row recording the Stripe customer id", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });

    await setStripeCustomer({
      organizationId: org.id,
      stripeCustomerId: "cus_123",
    });

    const sub = await getSubscription(org.id);
    expect(sub?.stripeCustomerId).toBe("cus_123");
    expect(sub?.status).toBe("INCOMPLETE");
  });
});

describe("syncSubscriptionFromStripe", () => {
  it("updates the subscription found by stripeCustomerId", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    await setStripeCustomer({
      organizationId: org.id,
      stripeCustomerId: "cus_456",
    });

    const periodEnd = new Date("2027-01-01T00:00:00Z");
    await syncSubscriptionFromStripe({
      stripeCustomerId: "cus_456",
      stripeSubscriptionId: "sub_789",
      plan: "MONTHLY",
      status: "ACTIVE",
      currentPeriodEnd: periodEnd,
    });

    const sub = await getSubscription(org.id);
    expect(sub?.stripeSubscriptionId).toBe("sub_789");
    expect(sub?.plan).toBe("MONTHLY");
    expect(sub?.status).toBe("ACTIVE");
    expect(sub?.currentPeriodEnd?.toISOString()).toBe(periodEnd.toISOString());
  });

  it("returns null when no subscription matches the customer id", async () => {
    const result = await syncSubscriptionFromStripe({
      stripeCustomerId: "cus_does_not_exist",
      stripeSubscriptionId: "sub_1",
      plan: "YEARLY",
      status: "ACTIVE",
      currentPeriodEnd: null,
    });
    expect(result).toBeNull();
  });
});

describe("adjustSubscriptionDays", () => {
  it("extends an existing expiration by the given number of days", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    await setSubscriptionExpiration(org.id, new Date("2026-09-20T00:00:00Z"));

    const newExpiration = await adjustSubscriptionDays(org.id, 15);

    expect(newExpiration.toISOString()).toBe("2026-10-05T00:00:00.000Z");
  });

  it("reduces an existing expiration for a negative delta", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    await setSubscriptionExpiration(org.id, new Date("2026-09-20T00:00:00Z"));

    const newExpiration = await adjustSubscriptionDays(org.id, -5);

    expect(newExpiration.toISOString()).toBe("2026-09-15T00:00:00.000Z");
  });

  it("bases off now when there's no existing subscription", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    const before = Date.now();

    const newExpiration = await adjustSubscriptionDays(org.id, 30);

    const expected = before + 30 * 24 * 60 * 60 * 1000;
    expect(Math.abs(newExpiration.getTime() - expected)).toBeLessThan(5000);
  });
});

describe("extendSubscriptionByDuration", () => {
  it("stacks the new duration on top of remaining time, not from now", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    await manuallyActivateSubscription(org.id, "MONTHLY", 120); // 4 months left

    const newExpiration = await extendSubscriptionByDuration({
      organizationId: org.id,
      plan: "SIX_MONTH",
      durationDays: 180, // +6 months
    });

    const sub = await getSubscription(org.id);
    expect(newExpiration.toISOString()).toBe(sub?.currentPeriodEnd?.toISOString());
    expect(sub?.plan).toBe("SIX_MONTH");
    expect(sub?.status).toBe("ACTIVE");

    // Roughly 10 months (300 days) out from the original activation, not 6.
    const before = Date.now();
    const expectedEnd = before + (120 + 180) * 24 * 60 * 60 * 1000;
    expect(Math.abs(newExpiration.getTime() - expectedEnd)).toBeLessThan(5000);
  });

  it("bases off now when there's no existing subscription", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    const before = Date.now();

    const newExpiration = await extendSubscriptionByDuration({
      organizationId: org.id,
      plan: "MONTHLY",
      durationDays: 30,
    });

    const expected = before + 30 * 24 * 60 * 60 * 1000;
    expect(Math.abs(newExpiration.getTime() - expected)).toBeLessThan(5000);
  });

  it("bases off now, not the stale date, when the existing subscription already expired", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    await setSubscriptionExpiration(org.id, new Date("2020-01-01T00:00:00Z"));
    const before = Date.now();

    const newExpiration = await extendSubscriptionByDuration({
      organizationId: org.id,
      plan: "MONTHLY",
      durationDays: 30,
    });

    const expected = before + 30 * 24 * 60 * 60 * 1000;
    expect(Math.abs(newExpiration.getTime() - expected)).toBeLessThan(5000);
  });
});

describe("manuallyActivateSubscription", () => {
  it("sets the plan, ACTIVE status, and a correct expiration", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    const before = Date.now();

    await manuallyActivateSubscription(org.id, "YEARLY", 365);

    const sub = await getSubscription(org.id);
    expect(sub?.plan).toBe("YEARLY");
    expect(sub?.status).toBe("ACTIVE");
    const expected = before + 365 * 24 * 60 * 60 * 1000;
    expect(Math.abs((sub?.currentPeriodEnd?.getTime() ?? 0) - expected)).toBeLessThan(5000);
  });
});

describe("isSubscriptionActive", () => {
  it("treats ACTIVE and TRIALING as active", () => {
    expect(isSubscriptionActive({ status: "ACTIVE" })).toBe(true);
    expect(isSubscriptionActive({ status: "TRIALING" })).toBe(true);
  });

  it("treats other statuses and null as not active", () => {
    expect(isSubscriptionActive({ status: "PAST_DUE" })).toBe(false);
    expect(isSubscriptionActive({ status: "CANCELED" })).toBe(false);
    expect(isSubscriptionActive({ status: "INCOMPLETE" })).toBe(false);
    expect(isSubscriptionActive(null)).toBe(false);
  });

  it("treats an ACTIVE status past its currentPeriodEnd as no longer active (nothing else expires it automatically)", () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    expect(isSubscriptionActive({ status: "ACTIVE", currentPeriodEnd: yesterday })).toBe(false);
  });

  it("treats an ACTIVE status before its currentPeriodEnd as active", () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    expect(isSubscriptionActive({ status: "ACTIVE", currentPeriodEnd: tomorrow })).toBe(true);
  });

  it("treats a missing currentPeriodEnd as no expiry, not as expired", () => {
    expect(isSubscriptionActive({ status: "ACTIVE", currentPeriodEnd: null })).toBe(true);
  });
});
