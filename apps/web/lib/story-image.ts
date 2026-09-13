import sharp from "sharp";

const STORY_WIDTH = 1080;
const STORY_HEIGHT = 1920;

/**
 * Turns the untouched post image (whatever size/ratio the model returned)
 * into a 9:16 Story-ready image, per the client's own request that the
 * post and Story should be "the same image, adjusted to fit the Story
 * format" rather than two separate generations. The foreground is only
 * ever scaled to fit the width, never cropped, so nothing in it - text,
 * logo, subject - is ever cut off; a blurred, cropped copy of the same
 * image fills the background behind it, purely as decoration.
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
