import { beforeEach, describe, expect, it } from "vitest";
import { createSessionToken, verifySessionToken } from "./session-token";

beforeEach(() => {
  process.env.AUTH_SECRET = "test-secret-at-least-this-long";
});

describe("session token", () => {
  it("round-trips userId, organizationId, and sessionVersion", async () => {
    const token = await createSessionToken({
      userId: "user_1",
      organizationId: "org_1",
      sessionVersion: 3,
    });
    const payload = await verifySessionToken(token);
    expect(payload).toEqual({
      userId: "user_1",
      organizationId: "org_1",
      sessionVersion: 3,
    });
  });

  it("rejects a tampered token", async () => {
    const token = await createSessionToken({
      userId: "user_1",
      organizationId: "org_1",
      sessionVersion: 0,
    });
    const tampered = token.slice(0, -2) + "xx";
    expect(await verifySessionToken(tampered)).toBeNull();
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await createSessionToken({
      userId: "user_1",
      organizationId: "org_1",
      sessionVersion: 0,
    });
    process.env.AUTH_SECRET = "a-completely-different-secret-value";
    expect(await verifySessionToken(token)).toBeNull();
  });
});
