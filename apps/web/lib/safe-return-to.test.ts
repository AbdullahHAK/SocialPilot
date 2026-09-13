import { describe, expect, it } from "vitest";
import { safeReturnTo } from "./safe-return-to";

describe("safeReturnTo", () => {
  it("accepts a same-origin relative path", () => {
    expect(safeReturnTo("/dashboard/brand", "/fallback")).toBe("/dashboard/brand");
  });

  it("accepts a relative path with a query string", () => {
    expect(safeReturnTo("/dashboard/create?returnTo=%2Fdashboard%2Fbrand", "/fallback")).toBe(
      "/dashboard/create?returnTo=%2Fdashboard%2Fbrand",
    );
  });

  it("falls back for a protocol-relative path (open redirect risk)", () => {
    expect(safeReturnTo("//evil.example.com", "/fallback")).toBe("/fallback");
  });

  it("falls back for an absolute external URL", () => {
    expect(safeReturnTo("https://evil.example.com", "/fallback")).toBe("/fallback");
  });

  it("falls back for null", () => {
    expect(safeReturnTo(null, "/fallback")).toBe("/fallback");
  });

  it("falls back for a non-string FormDataEntryValue", () => {
    const file = new File(["x"], "x.txt");
    expect(safeReturnTo(file, "/fallback")).toBe("/fallback");
  });
});
