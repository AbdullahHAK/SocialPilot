import { describe, expect, it } from "vitest";
import { buildImagePrompt, buildLogoPrompt } from "./brand-prompt";

describe("buildImagePrompt", () => {
  it("includes business context and brand-building guidance", () => {
    const result = buildImagePrompt("Promote our burger", {
      businessName: "Acme Burgers",
      category: "Fast food",
      tone: "Bold and fun",
      description: "We serve crispy chicken burgers.",
      colors: ["#ff0000", "#111111"],
    });

    expect(result).toContain("Promote our burger");
    expect(result).toContain("Acme Burgers (Fast food)");
    expect(result).toContain("We serve crispy chicken burgers.");
    expect(result).toContain("Bold and fun");
    expect(result).toContain("#ff0000, #111111");
    expect(result).toMatch(/do not add specific prices/i);
  });

  it("works with no brand context", () => {
    const result = buildImagePrompt("A latte on a table", null);
    expect(result).toContain("A latte on a table");
    expect(result).toMatch(/do not add specific prices/i);
  });

  it("appends extra guidance when given", () => {
    const result = buildImagePrompt("Promote our burger", null, "Theme: weekend special.");
    expect(result).toContain("Theme: weekend special.");
  });
});

describe("buildLogoPrompt", () => {
  it("includes the business name and logo-specific styling guidance", () => {
    const result = buildLogoPrompt("A bold chicken icon", "DC Chicken");
    expect(result).toContain("A bold chicken icon");
    expect(result).toContain("Business name: DC Chicken.");
    expect(result).toMatch(/plain white background/i);
    expect(result).toMatch(/no photographic elements/i);
  });

  it("works without a business name", () => {
    const result = buildLogoPrompt("A bold chicken icon");
    expect(result).toContain("A bold chicken icon");
    expect(result).not.toContain("Business name:");
  });
});
