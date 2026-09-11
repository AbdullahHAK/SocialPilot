import { describe, expect, it } from "vitest";
import { mapStripeStatusToSubscriptionStatus } from "./stripe";

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
