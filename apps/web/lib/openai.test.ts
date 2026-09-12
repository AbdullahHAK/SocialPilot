import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateCaption, generateImage } from "./openai";

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
    const [url, options] = fetchMock.mock.calls[0];
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
    const [url, options] = fetchMock.mock.calls[0];
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
});
