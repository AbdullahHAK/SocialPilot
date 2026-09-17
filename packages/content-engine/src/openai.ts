// No `import "server-only"` - unit-tested directly with mocked fetch, same
// reasoning as meta.ts and stripe.ts. Only ever imported from Server
// Actions under app/dashboard/create/**.

const IMAGE_MODEL = "gpt-image-2.5-sunburst";
const TEXT_MODEL = "gpt-4o-mini";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is not set`);
  }
  return value;
}

export interface GenerateImageInput {
  prompt: string;
  /** Reference photos (product shots, logo, inspiration) to guide the
   * result. When present, OpenAI's image *edit* endpoint is used instead of
   * plain text-to-image, since that's the one that accepts input images. */
  referenceImages?: Buffer[];
  size?: "1024x1024" | "1024x1536" | "1536x1024";
  quality?: "low" | "medium" | "high";
}

async function parseImageResponse(res: Response, context: string): Promise<Buffer> {
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${context} failed (${res.status}): ${body}`);
  }
  const data = (await res.json()) as { data?: Array<{ b64_json?: string }> };
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error(`${context}: no image data returned`);
  }
  return Buffer.from(b64, "base64");
}

export async function generateImage(input: GenerateImageInput): Promise<Buffer> {
  const apiKey = requireEnv("OPENAI_API_KEY");
  const size = input.size ?? "1024x1024";
  const quality = input.quality ?? "medium";

  if (input.referenceImages && input.referenceImages.length > 0) {
    const form = new FormData();
    form.append("model", IMAGE_MODEL);
    form.append("prompt", input.prompt);
    form.append("size", size);
    form.append("quality", quality);
    input.referenceImages.forEach((buffer, index) => {
      form.append(
        "image[]",
        new Blob([new Uint8Array(buffer)], { type: "image/png" }),
        `reference-${index}.png`,
      );
    });

    const res = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    return parseImageResponse(res, "OpenAI image edit");
  }

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      prompt: input.prompt,
      size,
      quality,
      n: 1,
    }),
  });
  return parseImageResponse(res, "OpenAI image generation");
}

export interface GenerateCaptionInput {
  businessName: string;
  tone?: string;
  /** Additional brand context, all optional - richer input produces a
   * more accurately on-brand caption, but every field here was already
   * optional before this was added, so omitting all of them reproduces
   * the original minimal behavior exactly. */
  category?: string;
  description?: string;
  productsServices?: string[];
  /** Language name (e.g. "French", "Arabic") to write the caption in;
   * omitted defaults to whatever language `brief` itself is written in. */
  language?: string;
  brief: string;
}

export interface GeneratedCaption {
  caption: string;
  hashtags: string[];
}

export async function generateCaption(
  input: GenerateCaptionInput,
): Promise<GeneratedCaption> {
  const apiKey = requireEnv("OPENAI_API_KEY");

  const contextLines = [
    `Business: ${input.businessName}${input.category ? ` (${input.category})` : ""}.`,
    input.description ? `About the business: ${input.description}.` : null,
    input.productsServices?.length
      ? `Products/services: ${input.productsServices.join(", ")}.`
      : null,
    `Tone: ${input.tone ?? "friendly"}.`,
    input.language ? `Write the caption in ${input.language}.` : null,
    `Post about: ${input.brief}`,
  ].filter((line): line is string => Boolean(line));

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: TEXT_MODEL,
      messages: [
        {
          role: "system",
          content:
            'You write short, engaging Instagram/Facebook captions with relevant hashtags for small businesses, using the "Post about" instruction as what this specific post should communicate - not as literal text to copy verbatim. Default to building brand recognition and making the business memorable - do not invent or mention a specific price, discount percentage, or limited-time deal unless the post topic explicitly names one; when no price is given, prefer broader phrases like "special offer available" or "discover our menu". Respond ONLY with JSON matching {"caption": string, "hashtags": string[]}. Hashtags should not include the "#" character.',
        },
        {
          role: "user",
          content: contextLines.join(" "),
        },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI caption generation failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI caption generation: no content returned");
  }

  const parsed = JSON.parse(content) as {
    caption?: string;
    hashtags?: string[];
  };
  return {
    caption: parsed.caption ?? "",
    hashtags: (parsed.hashtags ?? []).map((tag) => `#${tag.replace(/^#/, "")}`),
  };
}

export interface AnalyzedBrandDetails {
  category: string | null;
  tone: string | null;
  productsServices: string[];
  language: string | null;
}

/** Lets a business owner describe their business in their own words instead
 * of filling out separate rigid fields - this fills in the structured
 * fields (category, tone, products) from that free text. Callers should
 * treat the result as a starting point, not overwrite fields the user has
 * already filled in manually. */
export async function analyzeBrandDescription(
  description: string,
): Promise<AnalyzedBrandDetails> {
  const apiKey = requireEnv("OPENAI_API_KEY");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: TEXT_MODEL,
      messages: [
        {
          role: "system",
          content:
            'Extract structured brand details from a business owner\'s freeform description of their business. Respond ONLY with JSON matching {"category": string|null, "tone": string|null, "productsServices": string[], "language": string|null}. "category" is a short business category (e.g. "Fast food restaurant"). "tone" is a short content style description (e.g. "Warm and friendly" or "Bold and playful"). "productsServices" lists specific products or services mentioned, empty array if none. "language" is the name of the language the owner wants their content written in, if stated or clearly implied, otherwise null.',
        },
        { role: "user", content: description },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI brand analysis failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI brand analysis: no content returned");
  }

  const parsed = JSON.parse(content) as Partial<AnalyzedBrandDetails>;
  return {
    category: parsed.category ?? null,
    tone: parsed.tone ?? null,
    productsServices: Array.isArray(parsed.productsServices)
      ? parsed.productsServices.filter((item): item is string => typeof item === "string")
      : [],
    language: parsed.language ?? null,
  };
}

export interface BrandStyleProfile {
  colors: string[];
  typographyDirection: string;
  logoUsage: string;
  photographyStyle: string;
  lightingStyle: string;
  visualQuality: string;
  brandPersonality: string;
  designAesthetic: string;
}

/** Turns the one concept image a business owner approved into a portable,
 * text description of its visual STYLE - color palette, photography and
 * lighting style, quality bar, personality, aesthetic - rather than the
 * literal image itself. The client's explicit fix for repetitive-looking
 * posts: an approved image was being handed to every later generation as
 * an edit reference, which anchors composition and camera angle far more
 * than intended. This profile is used as text guidance instead, so future
 * posts stay on-brand without copying the approved photo's actual scene. */
export async function analyzeBrandStyle(
  imageUrl: string,
  brand: { businessName: string; category?: string | null },
): Promise<BrandStyleProfile> {
  const apiKey = requireEnv("OPENAI_API_KEY");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: TEXT_MODEL,
      messages: [
        {
          role: "system",
          content:
            'You are a brand creative director. Given one approved marketing image for a business, describe its visual STYLE in a way that could guide a photographer shooting a completely different scene for the same brand - not a description of this specific photo\'s subject or composition. Respond ONLY with JSON matching {"colors": string[], "typographyDirection": string, "logoUsage": string, "photographyStyle": string, "lightingStyle": string, "visualQuality": string, "brandPersonality": string, "designAesthetic": string}. "colors" are the dominant brand colors as short names or hex-ish descriptions. Each other field is one concise sentence. Do not mention or describe the specific subject, product, camera angle, or composition of this image - only transferable style traits (palette, light quality, texture, mood, polish level, personality).',
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Business: ${brand.businessName}${brand.category ? ` (${brand.category})` : ""}. Describe this approved image's transferable visual style.`,
            },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI brand style analysis failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI brand style analysis: no content returned");
  }

  const parsed = JSON.parse(content) as Partial<BrandStyleProfile>;
  return {
    colors: Array.isArray(parsed.colors)
      ? parsed.colors.filter((c): c is string => typeof c === "string")
      : [],
    typographyDirection: parsed.typographyDirection ?? "",
    logoUsage: parsed.logoUsage ?? "",
    photographyStyle: parsed.photographyStyle ?? "",
    lightingStyle: parsed.lightingStyle ?? "",
    visualQuality: parsed.visualQuality ?? "",
    brandPersonality: parsed.brandPersonality ?? "",
    designAesthetic: parsed.designAesthetic ?? "",
  };
}
