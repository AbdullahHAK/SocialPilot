import { describe, expect, it } from "vitest";
import { buildContentPrompt, buildImagePrompt, buildLogoPrompt } from "./brand-prompt";
import type { CreativeConcept } from "./openai";

const SAMPLE_CONCEPT: CreativeConcept = {
  scene: "Two friends splitting a pastry box on a sunny bakery patio.",
  subjects: "Two friends, mid-laugh, sharing a box of pastries.",
  setting: "The bakery's outdoor patio seating.",
  composition: "Rule-of-thirds, subjects off-center.",
  cameraAngle: "Low angle, looking upward.",
  lighting: "Warm, golden-hour light.",
  storyIdea: "Good company makes the treats even better.",
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

  it("includes the brief, brand context, and every field of the creative concept", () => {
    const result = buildContentPrompt("On-brand content", brand, null, SAMPLE_CONCEPT);

    expect(result).toContain("On-brand content");
    expect(result).toContain("Acme Bakery (Bakery)");
    expect(result).toContain(SAMPLE_CONCEPT.scene);
    expect(result).toContain(SAMPLE_CONCEPT.subjects);
    expect(result).toContain(SAMPLE_CONCEPT.setting);
    expect(result).toContain(SAMPLE_CONCEPT.composition);
    expect(result).toContain(SAMPLE_CONCEPT.cameraAngle);
    expect(result).toContain(SAMPLE_CONCEPT.lighting);
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
      SAMPLE_CONCEPT,
    );

    expect(result).toContain("warm, rustic food photography");
    expect(result).toContain("cozy and inviting");
    expect(result).toContain("deep red, cream");
    // The client's exact framing: "preserve the identity" + "not another
    // image similar to the approved one" both need to be present.
    expect(result).toMatch(/completely new visual concept/i);
    expect(result).toMatch(/not another image similar/i);
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
