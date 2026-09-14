import { describe, expect, it } from "vitest";
import { isBrandSetupComplete } from "./brand-setup";

describe("isBrandSetupComplete", () => {
  it("is false when there's no brand profile at all", () => {
    expect(isBrandSetupComplete(null, null)).toBe(false);
  });

  it("is false when the logo is missing", () => {
    expect(isBrandSetupComplete({ logoUrl: null }, {} as never)).toBe(false);
  });

  it("is false when no style has been approved yet", () => {
    expect(isBrandSetupComplete({ logoUrl: "https://example.com/logo.png" }, null)).toBe(false);
  });

  it("is true once both a logo and an approved style exist", () => {
    expect(
      isBrandSetupComplete({ logoUrl: "https://example.com/logo.png" }, {} as never),
    ).toBe(true);
  });
});
