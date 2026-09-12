import { describe, expect, it } from "vitest";
import { asStringArray } from "./brand-fields";

describe("asStringArray", () => {
  it("returns the array when it's a non-empty string array", () => {
    expect(asStringArray(["#ff0000", "#111111"])).toEqual(["#ff0000", "#111111"]);
  });

  it("returns null for an empty array", () => {
    expect(asStringArray([])).toBeNull();
  });

  it("returns null for non-array values", () => {
    expect(asStringArray(null)).toBeNull();
    expect(asStringArray(undefined)).toBeNull();
    expect(asStringArray("not an array")).toBeNull();
    expect(asStringArray({ a: 1 })).toBeNull();
  });

  it("filters out non-string entries", () => {
    expect(asStringArray(["a", 1, null, "b"])).toEqual(["a", "b"]);
  });
});
