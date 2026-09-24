import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  analyzeBrandDescription,
  analyzeBrandStyle,
  generateCaption,
  generateImage,
  planCreativeConcept,
} from "./openai";

beforeEach(() => {
  vi.stubEnv("OPENAI_API_KEY", "test-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("generateImage", () => {
  it("calls the generations endpoint when there are no reference images", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [{ b64_json: Buffer.from("fake-png").toString("base64") }] }), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateImage({ prompt: "A latte on a table" });

    expect(result.toString()).toBe("fake-png");
    const [url, options] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.openai.com/v1/images/generations");
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body).prompt).toBe("A latte on a table");
  });

  it("calls the edits endpoint with a multipart body when reference images are given", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [{ b64_json: Buffer.from("edited-png").toString("base64") }] }), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateImage({
      prompt: "Use this logo",
      referenceImages: [Buffer.from("logo-bytes")],
    });

    expect(result.toString()).toBe("edited-png");
    const [url, options] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.openai.com/v1/images/edits");
    expect(options.body).toBeInstanceOf(FormData);
  });

  it("throws with the response body on a non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("limit reached", { status: 429 })),
    );

    await expect(generateImage({ prompt: "anything" })).rejects.toThrow(
      /limit reached/,
    );
  });

  it("throws when the response has no image data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{}] }), { status: 200 })),
    );

    await expect(generateImage({ prompt: "anything" })).rejects.toThrow(
      /no image data/,
    );
  });
});

describe("generateCaption", () => {
  it("parses the caption and hashtags from the model response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    caption: "Weekend special is here!",
                    hashtags: ["weekendoffer", "burger"],
                  }),
                },
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );

    const result = await generateCaption({
      businessName: "Acme Burgers",
      brief: "Weekend chicken burger offer",
    });

    expect(result.caption).toBe("Weekend special is here!");
    expect(result.hashtags).toEqual(["#weekendoffer", "#burger"]);
  });

  it("includes category, products/services, and language when provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ caption: "x", hashtags: [] }) } }],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await generateCaption({
      businessName: "Acme Burgers",
      category: "Fast food restaurant",
      description: "A family-owned burger joint since 1990",
      productsServices: ["Chicken burgers", "Fries"],
      language: "French",
      tone: "Bold and playful",
      brief: "Promote our new chicken meal, highlight the crispy chicken",
    });

    const [, options] = fetchMock.mock.calls[0]!;
    const body = JSON.parse(options.body as string);
    const userMessage = body.messages[1].content as string;
    expect(userMessage).toContain("Fast food restaurant");
    expect(userMessage).toContain("family-owned burger joint since 1990");
    expect(userMessage).toContain("Chicken burgers, Fries");
    expect(userMessage).toContain("Write the caption in French");
    expect(userMessage).toContain("Bold and playful");
    expect(userMessage).toContain("Promote our new chicken meal");
  });

  it("omits optional context lines entirely when not provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ caption: "x", hashtags: [] }) } }],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await generateCaption({ businessName: "Acme Burgers", brief: "Weekend offer" });

    const [, options] = fetchMock.mock.calls[0]!;
    const body = JSON.parse(options.body as string);
    const userMessage = body.messages[1].content as string;
    expect(userMessage).not.toContain("Products/services");
    expect(userMessage).not.toContain("Write the caption in");
    expect(userMessage).toContain("Tone: friendly");
  });
});

describe("analyzeBrandDescription", () => {
  it("parses structured brand details from the model response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    category: "Fast food restaurant",
                    tone: "Bold and playful",
                    productsServices: ["Crispy chicken burger", "Fries"],
                    language: "Arabic",
                  }),
                },
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );

    const result = await analyzeBrandDescription(
      "We sell crispy chicken burgers, want bold content in Arabic",
    );

    expect(result).toEqual({
      category: "Fast food restaurant",
      tone: "Bold and playful",
      productsServices: ["Crispy chicken burger", "Fries"],
      language: "Arabic",
    });
  });

  it("defaults missing fields to null/empty", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ choices: [{ message: { content: "{}" } }] }),
          { status: 200 },
        ),
      ),
    );

    const result = await analyzeBrandDescription("A small shop");
    expect(result).toEqual({
      category: null,
      tone: null,
      productsServices: [],
      language: null,
    });
  });
});

describe("planCreativeConcept", () => {
  function mockConceptResponse(overrides: Partial<Record<string, string>> = {}) {
    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                scene: "Two friends splitting a pastry box on the patio.",
                subjects: "Two friends, mid-laugh.",
                setting: "Outdoor patio seating.",
                composition: "Rule-of-thirds.",
                cameraAngle: "Low angle.",
                lighting: "Golden-hour light.",
                storyIdea: "Good company makes it better.",
                ...overrides,
              }),
            },
          },
        ],
      }),
      { status: 200 },
    );
  }

  it("parses the creative concept from the model response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockConceptResponse()));

    const result = await planCreativeConcept({
      businessName: "Acme Bakery",
      styleProfile: null,
      archetype: { key: "social", label: "A social gathering." },
      brief: "on-brand content",
      recentScenes: [],
    });

    expect(result).toEqual({
      scene: "Two friends splitting a pastry box on the patio.",
      subjects: "Two friends, mid-laugh.",
      setting: "Outdoor patio seating.",
      composition: "Rule-of-thirds.",
      cameraAngle: "Low angle.",
      lighting: "Golden-hour light.",
      storyIdea: "Good company makes it better.",
    });
  });

  it("sends the business context, required archetype, and style profile to the model", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockConceptResponse());
    vi.stubGlobal("fetch", fetchMock);

    await planCreativeConcept({
      businessName: "Acme Bakery",
      category: "Bakery",
      description: "A cozy neighborhood bakery.",
      tone: "Warm and friendly",
      colors: ["#7a4a2b"],
      styleProfile: {
        colors: ["deep red"],
        typographyDirection: "",
        logoUsage: "",
        photographyStyle: "warm, rustic food photography",
        lightingStyle: "",
        visualQuality: "",
        brandPersonality: "cozy and inviting",
        designAesthetic: "",
      },
      archetype: { key: "social", label: "A social gathering - friends sharing the moment." },
      brief: "on-brand content",
      recentScenes: [],
    });

    const [, options] = fetchMock.mock.calls[0]!;
    const body = JSON.parse(options.body as string);
    const userMessage = body.messages[1].content as string;
    expect(userMessage).toContain("Acme Bakery (Bakery)");
    expect(userMessage).toContain("A cozy neighborhood bakery.");
    expect(userMessage).toContain("Warm and friendly");
    expect(userMessage).toContain("#7a4a2b");
    expect(userMessage).toContain("warm, rustic food photography");
    expect(userMessage).toContain("cozy and inviting");
    expect(userMessage).toContain("A social gathering - friends sharing the moment.");
  });

  it("tells the model exactly which recent scenes to avoid repeating", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockConceptResponse());
    vi.stubGlobal("fetch", fetchMock);

    await planCreativeConcept({
      businessName: "Acme Bakery",
      styleProfile: null,
      archetype: { key: "solo", label: "A solo moment." },
      brief: "on-brand content",
      recentScenes: ["A rider delivering a box.", "A close-up of the pastry case."],
    });

    const [, options] = fetchMock.mock.calls[0]!;
    const body = JSON.parse(options.body as string);
    const userMessage = body.messages[1].content as string;
    expect(userMessage).toMatch(/genuinely different/i);
    expect(userMessage).toContain("A rider delivering a box.");
    expect(userMessage).toContain("A close-up of the pastry case.");
  });

  it("says nothing about avoiding repeats when there's no prior history", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockConceptResponse());
    vi.stubGlobal("fetch", fetchMock);

    await planCreativeConcept({
      businessName: "Acme Bakery",
      styleProfile: null,
      archetype: { key: "solo", label: "A solo moment." },
      brief: "on-brand content",
      recentScenes: [],
    });

    const [, options] = fetchMock.mock.calls[0]!;
    const body = JSON.parse(options.body as string);
    const userMessage = body.messages[1].content as string;
    expect(userMessage).not.toMatch(/already used recently/i);
  });

  it("defaults missing fields to empty strings", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }), { status: 200 }),
      ),
    );

    const result = await planCreativeConcept({
      businessName: "Acme Bakery",
      styleProfile: null,
      archetype: { key: "solo", label: "A solo moment." },
      brief: "on-brand content",
      recentScenes: [],
    });

    expect(result).toEqual({
      scene: "",
      subjects: "",
      setting: "",
      composition: "",
      cameraAngle: "",
      lighting: "",
      storyIdea: "",
    });
  });

  it("throws with the response body on a non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("rate limited", { status: 429 })));

    await expect(
      planCreativeConcept({
        businessName: "Acme Bakery",
        styleProfile: null,
        archetype: { key: "solo", label: "A solo moment." },
        brief: "on-brand content",
        recentScenes: [],
      }),
    ).rejects.toThrow(/rate limited/);
  });
});

describe("analyzeBrandStyle", () => {
  it("sends the image as a vision message and parses the structured style profile", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  colors: ["deep red", "cream"],
                  typographyDirection: "Bold, condensed sans-serif.",
                  logoUsage: "Small, corner-placed mark.",
                  photographyStyle: "Warm, rustic food photography.",
                  lightingStyle: "Golden-hour natural light.",
                  visualQuality: "Premium, editorial polish.",
                  brandPersonality: "Cozy and inviting.",
                  designAesthetic: "Rustic-modern.",
                }),
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await analyzeBrandStyle("https://example.com/approved.png", {
      businessName: "Acme Bakery",
      category: "Bakery",
    });

    expect(result).toEqual({
      colors: ["deep red", "cream"],
      typographyDirection: "Bold, condensed sans-serif.",
      logoUsage: "Small, corner-placed mark.",
      photographyStyle: "Warm, rustic food photography.",
      lightingStyle: "Golden-hour natural light.",
      visualQuality: "Premium, editorial polish.",
      brandPersonality: "Cozy and inviting.",
      designAesthetic: "Rustic-modern.",
    });

    const [, options] = fetchMock.mock.calls[0]!;
    const body = JSON.parse(options.body);
    const userMessage = body.messages.find((m: { role: string }) => m.role === "user");
    const imagePart = userMessage.content.find((c: { type: string }) => c.type === "image_url");
    expect(imagePart.image_url.url).toBe("https://example.com/approved.png");
  });

  it("defaults missing fields to empty", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }), { status: 200 }),
      ),
    );

    const result = await analyzeBrandStyle("https://example.com/approved.png", {
      businessName: "Acme",
    });
    expect(result).toEqual({
      colors: [],
      typographyDirection: "",
      logoUsage: "",
      photographyStyle: "",
      lightingStyle: "",
      visualQuality: "",
      brandPersonality: "",
      designAesthetic: "",
    });
  });
});
