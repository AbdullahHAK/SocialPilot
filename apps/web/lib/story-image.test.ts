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
  it("never crops the foreground - a marker at the very top and bottom of the source both survive", async () => {
    // The client's exact complaint: text/logo near the edge of the source
    // getting cut off. The foreground must only ever be scaled to fit the
    // width, never cropped, so a marker band at the very top row and one
    // at the very bottom row of the source must both still be visible,
    // just inside the letterboxed foreground rather than sliced away.
    const sourceWidth = 1024;
    const sourceHeight = 1200;
    const bandHeight = 30;

    const source = await sharp({
      create: { width: sourceWidth, height: sourceHeight, channels: 3, background: { r: 10, g: 10, b: 10 } },
    })
      .composite([
        {
          input: await sharp({
            create: { width: sourceWidth, height: bandHeight, channels: 3, background: { r: 255, g: 0, b: 0 } },
          })
            .png()
            .toBuffer(),
          top: 0,
          left: 0,
        },
        {
          input: await sharp({
            create: { width: sourceWidth, height: bandHeight, channels: 3, background: { r: 0, g: 255, b: 0 } },
          })
            .png()
            .toBuffer(),
          top: sourceHeight - bandHeight,
          left: 0,
        },
      ])
      .png()
      .toBuffer();

    const result = await createStoryImage(source);
    const { data, info } = await sharp(result).raw().toBuffer({ resolveWithObject: true });

    function pixelAt(x: number, y: number) {
      const i = (y * info.width + x) * info.channels;
      return [data[i], data[i + 1], data[i + 2]];
    }

    // Mirrors createStoryImage's own math for where the letterboxed
    // foreground lands, to sample just inside its top and bottom edges.
    const foregroundHeight = Math.round((info.width * sourceHeight) / sourceWidth);
    const top = Math.round((info.height - foregroundHeight) / 2);
    const centerX = Math.floor(info.width / 2);

    const [rTop, gTop, bTop] = pixelAt(centerX, top + 3);
    const [rBottom, gBottom, bBottom] = pixelAt(centerX, top + foregroundHeight - 4);

    expect([rTop > 200, gTop < 60, bTop < 60]).toEqual([true, true, true]);
    expect([gBottom > 200, rBottom < 60, bBottom < 60]).toEqual([true, true, true]);
  });

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
