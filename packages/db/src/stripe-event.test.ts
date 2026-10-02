import { afterEach, describe, expect, it } from "vitest";
import { claimStripeEvent } from "./stripe-event";
import { prisma } from "./index";

afterEach(async () => {
  await prisma.processedStripeEvent.deleteMany();
});

describe("claimStripeEvent", () => {
  it("claims an event id it hasn't seen before", async () => {
    const claimed = await claimStripeEvent("evt_test_1");
    expect(claimed).toBe(true);

    const record = await prisma.processedStripeEvent.findUnique({
      where: { id: "evt_test_1" },
    });
    expect(record).not.toBeNull();
  });

  it("refuses to claim the same event id twice", async () => {
    const first = await claimStripeEvent("evt_test_2");
    const second = await claimStripeEvent("evt_test_2");

    expect(first).toBe(true);
    expect(second).toBe(false);
  });

  it("never lets a concurrent race claim the same event id twice", async () => {
    const results = await Promise.all([
      claimStripeEvent("evt_test_race"),
      claimStripeEvent("evt_test_race"),
      claimStripeEvent("evt_test_race"),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
  });
});
