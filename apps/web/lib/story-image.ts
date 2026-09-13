import sharp from "sharp";

const STORY_WIDTH = 1080;
const STORY_HEIGHT = 1920;

/**
 * Turns a square (or any-ratio) post image into a 9:16 Story-ready image,
 * per the client's own request that the post and Story should be "the
 * same image, adjusted to fit the Story format" rather than two separate
 * generations: a blurred, cropped copy of the same image fills the
 * background, with the original centered on top at full width - the
 * standard "square post to Story" treatment, so it reads as an
 * intentional crop rather than an awkward letterboxed image.
 */
export async function createStoryImage(sourceImage: Buffer): Promise<Buffer> {
  const background = await sharp(sourceImage)
    .resize(STORY_WIDTH, STORY_HEIGHT, { fit: "cover" })
    .blur(40)
    .modulate({ brightness: 0.7 })
    .toBuffer();

  const metadata = await sharp(sourceImage).metadata();
  const sourceWidth = metadata.width ?? STORY_WIDTH;
  const sourceHeight = metadata.height ?? STORY_WIDTH;
  const foregroundHeight = Math.round((STORY_WIDTH * sourceHeight) / sourceWidth);

  const foreground = await sharp(sourceImage)
    .resize(STORY_WIDTH, foregroundHeight)
    .toBuffer();

  const top = Math.max(0, Math.round((STORY_HEIGHT - foregroundHeight) / 2));

  return sharp(background)
    .composite([{ input: foreground, top, left: 0 }])
    .png()
    .toBuffer();
}
