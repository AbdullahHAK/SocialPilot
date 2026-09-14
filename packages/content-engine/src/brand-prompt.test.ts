import { describe, expect, it } from "vitest";
import { buildContentPrompt, buildImagePrompt, buildLogoPrompt, type CreativeVariation } from "./brand-prompt";

const SAMPLE_VARIATION: CreativeVariation = {
  contentTheme: "Highlight the best-seller.",
  subject: "The product itself as the hero.",
  cameraAngle: "Low angle, looking upward.",
  cameraDistance: "Close-up framing.",
  composition: "Rule-of-thirds, subject off-center.",
  environment: "Outdoors in natural surroundings.",
  lighting: "Warm, golden-hour light.",
};

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
    expect(result).toMatch(/do not recreate their exact composition/i);
    expect(result).toMatch(/should not look ai-generated/i);
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

describe("buildContentPrompt", () => {
  const brand = {
    businessName: "Acme Bakery",
    category: "Bakery",
    tone: "Warm and friendly",
    description: "A cozy neighborhood bakery.",
    colors: ["#7a4a2b"],
  };

  it("includes the brief, brand context, and every variation axis", () => {
    const result = buildContentPrompt("On-brand content", brand, null, SAMPLE_VARIATION, []);

    expect(result).toContain("On-brand content");
    expect(result).toContain("Acme Bakery (Bakery)");
    expect(result).toContain(SAMPLE_VARIATION.subject);
    expect(result).toContain(SAMPLE_VARIATION.cameraAngle);
    expect(result).toContain(SAMPLE_VARIATION.cameraDistance);
    expect(result).toContain(SAMPLE_VARIATION.composition);
    expect(result).toContain(SAMPLE_VARIATION.environment);
    expect(result).toContain(SAMPLE_VARIATION.lighting);
  });

  it("renders the style profile as text guidance and says this must be a new concept, not a copy", () => {
    const result = buildContentPrompt(
      "On-brand content",
      brand,
      {
        colors: ["deep red", "cream"],
        typographyDirection: "",
        logoUsage: "",
        photographyStyle: "warm, rustic food photography",
        lightingStyle: "",
        visualQuality: "",
        brandPersonality: "cozy and inviting",
        designAesthetic: "",
      },
      SAMPLE_VARIATION,
      [],
    );

    expect(result).toContain("warm, rustic food photography");
    expect(result).toContain("cozy and inviting");
    expect(result).toContain("deep red, cream");
    // The client's exact framing: "preserve the identity" + "not another
    // image similar to the approved one" both need to be present.
    expect(result).toMatch(/completely new visual concept/i);
    expect(result).toMatch(/not another image similar/i);
  });

  it("lists recent posts' choices as combinations not to repeat", () => {
    const result = buildContentPrompt("On-brand content", brand, null, SAMPLE_VARIATION, [
      { subject: "A person enjoying it.", cameraAngle: "Eye-level, straight-on." },
    ]);

    expect(result).toMatch(/do not repeat/i);
    expect(result).toContain("A person enjoying it.");
    expect(result).toContain("Eye-level, straight-on.");
  });

  it("says nothing about avoiding repeats when there's no prior history", () => {
    const result = buildContentPrompt("On-brand content", brand, null, SAMPLE_VARIATION, []);
    expect(result).not.toMatch(/do not repeat/i);
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
