import { afterEach, describe, expect, it, vi } from "vitest";
import { decryptToken, encryptToken } from "./crypto";

// TOKEN_ENCRYPTION_KEY is set globally for the whole test run (see .env /
// CI workflow), not mutated per-test here: process.env is shared by every
// test file running in the same worker, so per-test mutation leaks across
// files. vi.stubEnv/unstubAllEnvs is the one safe exception, used below for
// the single test that needs the key genuinely absent.

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("token encryption", () => {
  it("round-trips a plaintext value", () => {
    const cipherText = encryptToken("super-secret-access-token");
    expect(decryptToken(cipherText)).toBe("super-secret-access-token");
  });

  it("produces different ciphertext for the same input each time", () => {
    const a = encryptToken("same-input");
    const b = encryptToken("same-input");
    expect(a).not.toBe(b);
    expect(decryptToken(a)).toBe("same-input");
    expect(decryptToken(b)).toBe("same-input");
  });

  it("throws when the ciphertext has been tampered with", () => {
    const cipherText = encryptToken("secret");
    const tampered = cipherText.slice(0, -4) + "abcd";
    expect(() => decryptToken(tampered)).toThrow();
  });

  it("throws when TOKEN_ENCRYPTION_KEY is missing", () => {
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", "");
    expect(() => encryptToken("secret")).toThrow(
      /TOKEN_ENCRYPTION_KEY environment variable is not set/,
    );
  });
});
