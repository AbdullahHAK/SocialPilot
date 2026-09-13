import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { createStoryImage } from "./story-image";

async function makeTestImage(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 200, g: 100, b: 50 },
    },
  })
    .png()
    .toBuffer();
}

describe("createStoryImage", () => {
  it("produces a 1080x1920 (9:16) image from a square source", async () => {
    const source = await makeTestImage(1024, 1024);

    const result = await createStoryImage(source);

    const metadata = await sharp(result).metadata();
    expect(metadata.width).toBe(1080);
    expect(metadata.height).toBe(1920);
    expect(metadata.format).toBe("png");
  });

  it("also produces a 1080x1920 image from a non-square source", async () => {
    const source = await makeTestImage(800, 600);

    const result = await createStoryImage(source);

    const metadata = await sharp(result).metadata();
    expect(metadata.width).toBe(1080);
    expect(metadata.height).toBe(1920);
  });

  it("returns a valid, decodable PNG", async () => {
    const source = await makeTestImage(512, 512);

    const result = await createStoryImage(source);

    // Would throw if the output weren't a valid image.
    const stats = await sharp(result).stats();
    expect(stats.channels.length).toBeGreaterThan(0);
  });
});
