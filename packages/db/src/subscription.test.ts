import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "./index";
import {
  getSubscription,
  isSubscriptionActive,
  setStripeCustomer,
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
});
