// No `import "server-only"` - unit-tested directly with mocked fetch, same
// reasoning as meta.ts and stripe.ts. Only ever imported from Server
// Actions under app/dashboard/create/**.

const IMAGE_MODEL = "gpt-image-1.5";
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
            'You write short, engaging Instagram/Facebook captions with relevant hashtags for small businesses. Respond ONLY with JSON matching {"caption": string, "hashtags": string[]}. Hashtags should not include the "#" character.',
        },
        {
          role: "user",
          content: `Business: ${input.businessName}. Tone: ${input.tone ?? "friendly"}. Post about: ${input.brief}`,
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
