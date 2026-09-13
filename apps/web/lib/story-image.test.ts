import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { createStoryImage, cropToPostFormat } from "./story-image";

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

describe("cropToPostFormat", () => {
  it("crops the AI's native portrait output down to Instagram's 1080x1350 (4:5) post ratio", async () => {
    const source = await makeTestImage(1024, 1536);

    const result = await cropToPostFormat(source);

    const metadata = await sharp(result).metadata();
    expect(metadata.width).toBe(1080);
    expect(metadata.height).toBe(1350);
    expect(metadata.format).toBe("png");
  });

  it("also works from a square source", async () => {
    const source = await makeTestImage(1024, 1024);

    const result = await cropToPostFormat(source);

    const metadata = await sharp(result).metadata();
    expect(metadata.width).toBe(1080);
    expect(metadata.height).toBe(1350);
  });

  it("keeps the very top of the image intact, cropping only from the bottom", async () => {
    // The AI consistently places headline/banner text right at the top of
    // the frame - a center crop sliced through it (the client's exact
    // "text cut off" report). This proves a marker band at row 0 survives.
    const background = await sharp({
      create: { width: 1024, height: 1536, channels: 3, background: { r: 10, g: 10, b: 10 } },
    })
      .png()
      .toBuffer();
    const topBand = await sharp({
      create: { width: 1024, height: 40, channels: 3, background: { r: 255, g: 0, b: 0 } },
    })
      .png()
      .toBuffer();
    const source = await sharp(background)
      .composite([{ input: topBand, top: 0, left: 0 }])
      .png()
      .toBuffer();

    const result = await cropToPostFormat(source);

    const topPixel = await sharp(result)
      .extract({ left: 0, top: 0, width: 1, height: 1 })
      .raw()
      .toBuffer();
    expect([topPixel[0], topPixel[1], topPixel[2]]).toEqual([255, 0, 0]);
  });
});

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
