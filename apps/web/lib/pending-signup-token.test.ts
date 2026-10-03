import { beforeEach, describe, expect, it } from "vitest";
import {
  createPendingSignupToken,
  verifyPendingSignupToken,
} from "./pending-signup-token";

beforeEach(() => {
  process.env.AUTH_SECRET = "test-secret-at-least-this-long";
});

describe("pending signup token", () => {
  it("round-trips plan and Stripe fields", async () => {
    const token = await createPendingSignupToken({
      plan: "YEARLY",
      stripeCustomerId: "cus_123",
      stripeSubscriptionId: "sub_456",
    });
    const payload = await verifyPendingSignupToken(token);
    expect(payload).toEqual({
      plan: "YEARLY",
      stripeCustomerId: "cus_123",
      stripeSubscriptionId: "sub_456",
      metaPages: undefined,
    });
  });

  it("round-trips meta pages", async () => {
    const token = await createPendingSignupToken({
      plan: "MONTHLY",
      metaPages: [
        {
          provider: "FACEBOOK",
          externalId: "page_1",
          displayName: "Acme Page",
          encryptedAccessToken: "iv.tag.data",
        },
      ],
    });
    const payload = await verifyPendingSignupToken(token);
    expect(payload?.metaPages).toHaveLength(1);
    expect(payload?.metaPages?.[0]).toMatchObject({
      provider: "FACEBOOK",
      externalId: "page_1",
    });
  });

  it("round-trips an activation-code signup with no plan chosen", async () => {
    const token = await createPendingSignupToken({ activationCode: "YOPA-ABCD-1234" });
    const payload = await verifyPendingSignupToken(token);
    expect(payload).toEqual({
      plan: undefined,
      stripeCustomerId: undefined,
      stripeSubscriptionId: undefined,
      metaPages: undefined,
      activationCode: "YOPA-ABCD-1234",
    });
  });

  it("round-trips a terms acceptance record", async () => {
    const token = await createPendingSignupToken({
      plan: "MONTHLY",
      termsAcceptance: {
        version: "2026-09-21",
        acceptedAt: "2026-10-03T12:00:00.000Z",
        ipAddress: "203.0.113.4",
      },
    });
    const payload = await verifyPendingSignupToken(token);
    expect(payload?.termsAcceptance).toEqual({
      version: "2026-09-21",
      acceptedAt: "2026-10-03T12:00:00.000Z",
      ipAddress: "203.0.113.4",
    });
  });

  it("round-trips a terms acceptance record with no ip address known", async () => {
    const token = await createPendingSignupToken({
      plan: "MONTHLY",
      termsAcceptance: {
        version: "2026-09-21",
        acceptedAt: "2026-10-03T12:00:00.000Z",
        ipAddress: null,
      },
    });
    const payload = await verifyPendingSignupToken(token);
    expect(payload?.termsAcceptance?.ipAddress).toBeNull();
  });

  it("rejects a token with an invalid (but present) plan value", async () => {
    const token = await createPendingSignupToken({
      // @ts-expect-error - deliberately invalid for this test
      plan: "NOT_A_PLAN",
    });
    expect(await verifyPendingSignupToken(token)).toBeNull();
  });

  it("rejects a tampered token", async () => {
    const token = await createPendingSignupToken({ plan: "MONTHLY" });
    const tampered = token.slice(0, -2) + "xx";
    expect(await verifyPendingSignupToken(tampered)).toBeNull();
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await createPendingSignupToken({ plan: "MONTHLY" });
    process.env.AUTH_SECRET = "a-completely-different-secret-value";
    expect(await verifyPendingSignupToken(token)).toBeNull();
  });
});
