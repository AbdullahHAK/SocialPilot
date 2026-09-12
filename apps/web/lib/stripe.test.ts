import { afterEach, describe, expect, it, vi } from "vitest";
import { isStripeConfigured, mapStripeStatusToSubscriptionStatus } from "./stripe";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isStripeConfigured", () => {
  it("is false when any required env var is missing", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    vi.stubEnv("STRIPE_PRICE_ID_MONTHLY", "");
    vi.stubEnv("STRIPE_PRICE_ID_YEARLY", "");
    expect(isStripeConfigured()).toBe(false);

    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
    expect(isStripeConfigured()).toBe(false);
  });

  it("is true once all three are set", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
    vi.stubEnv("STRIPE_PRICE_ID_MONTHLY", "price_monthly");
    vi.stubEnv("STRIPE_PRICE_ID_YEARLY", "price_yearly");
    expect(isStripeConfigured()).toBe(true);
  });
});

describe("mapStripeStatusToSubscriptionStatus", () => {
  it("maps trialing and active statuses directly", () => {
    expect(mapStripeStatusToSubscriptionStatus("trialing")).toBe("TRIALING");
    expect(mapStripeStatusToSubscriptionStatus("active")).toBe("ACTIVE");
  });

  it("maps past_due and unpaid to PAST_DUE", () => {
    expect(mapStripeStatusToSubscriptionStatus("past_due")).toBe("PAST_DUE");
    expect(mapStripeStatusToSubscriptionStatus("unpaid")).toBe("PAST_DUE");
  });

  it("maps canceled and incomplete_expired to CANCELED", () => {
    expect(mapStripeStatusToSubscriptionStatus("canceled")).toBe("CANCELED");
    expect(mapStripeStatusToSubscriptionStatus("incomplete_expired")).toBe(
      "CANCELED",
    );
  });

  it("falls back to INCOMPLETE for anything else", () => {
    expect(mapStripeStatusToSubscriptionStatus("incomplete")).toBe(
      "INCOMPLETE",
    );
    expect(mapStripeStatusToSubscriptionStatus("paused")).toBe("INCOMPLETE");
  });
});
