import sharp from "sharp";

const POST_WIDTH = 1080;
const POST_HEIGHT = 1350;
const STORY_WIDTH = 1080;
const STORY_HEIGHT = 1920;

/**
 * Crops the AI's raw output (whatever size it came back at) down to
 * Instagram's actual recommended post ratio, 1080x1350 (4:5) - the client
 * was explicit that this, not a square, should be the one "master" image
 * generation everything else derives from.
 */
export async function cropToPostFormat(sourceImage: Buffer): Promise<Buffer> {
  return sharp(sourceImage)
    .resize(POST_WIDTH, POST_HEIGHT, { fit: "cover" })
    .png()
    .toBuffer();
}

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
