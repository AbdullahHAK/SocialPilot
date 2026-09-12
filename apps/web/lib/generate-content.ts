import {
  createContentPost,
  getBrandCreativeProfile,
  getBrandProfile,
  type Platform,
} from "@socialpilot/db";
import { asStringArray } from "./brand-fields";
import { buildImagePrompt } from "./brand-prompt";
import { fetchImageBuffer } from "./fetch-image";
import { generateCaption, generateImage } from "./openai";
import { uploadGeneratedImage } from "./storage";

// Cycled by call index so a run of daily/weekly content doesn't repeat the
// same angle every time, even though it's the same approved visual style -
// matches the client's "quality today, bestseller tomorrow" request.
export const CONTENT_THEMES = [
  "Focus on the standout quality and craftsmanship of the product.",
  "Highlight the business's most popular, best-selling item.",
  "Focus on general brand awareness - what makes this business memorable, not a specific product.",
  "Showcase how the product is presented and served, an appetizing close-up.",
  "Highlight a special offer or promotion in broad terms, without inventing a specific price.",
  "Center the content on the customer experience and enjoyment of the brand.",
  "Focus on the brand's atmosphere and personality rather than one specific product.",
] as const;

export interface GenerateAndScheduleInput {
  organizationId: string;
  platform: Platform;
  scheduledFor: Date;
  themeIndex?: number;
}

/**
 * Generates one on-brand image + caption and schedules it as a
 * ContentPost. Requires an approved creative style and logo - returns
 * `{ skipped: "not_ready" }` rather than throwing if either is missing, so
 * callers (the periodic job especially) can just move on to the next
 * organization instead of treating "hasn't set up their brand yet" as an
 * error.
 */
export async function generateAndScheduleContent(
  input: GenerateAndScheduleInput,
): Promise<{ success: boolean; skipped?: "not_ready" }> {
  const [creativeProfile, brandProfile] = await Promise.all([
    getBrandCreativeProfile(input.organizationId),
    getBrandProfile(input.organizationId),
  ]);

  if (!creativeProfile || !brandProfile?.logoUrl) {
    return { success: false, skipped: "not_ready" };
  }

  const brief = creativeProfile.promptTemplateAdditions ?? "on-brand social media content";
  const theme = CONTENT_THEMES[(input.themeIndex ?? 0) % CONTENT_THEMES.length];
  const brandContext = {
    businessName: brandProfile.businessName,
    category: brandProfile.category,
    tone: brandProfile.tone,
    description: brandProfile.description,
    colors: asStringArray(brandProfile.colors),
  };

  // The approved concept image anchors the look, the logo keeps brand
  // identity intact - passed as references so the visual style actually
  // stays consistent (not just prompted to).
  const referenceUrls = [
    creativeProfile.referenceImageUrls[0],
    brandProfile.logoUrl,
  ].filter((url): url is string => Boolean(url));
  const referenceImages = (
    await Promise.all(
      referenceUrls.map(async (url) => {
        try {
          return await fetchImageBuffer(url);
        } catch (error) {
          console.error("Fetching a style reference image failed", error);
          return null;
        }
      }),
    )
  ).filter((buffer): buffer is Buffer => buffer !== null);

  try {
    const imageBuffer = await generateImage({
      prompt: buildImagePrompt(
        brief,
        brandContext,
        `${theme} Consistent with the brand's established visual style.`,
      ),
      referenceImages,
    });
    const imageUrl = await uploadGeneratedImage(input.organizationId, imageBuffer);
    const { caption, hashtags } = await generateCaption({
      businessName: brandProfile.businessName,
      tone: brandProfile.tone ?? undefined,
      brief: `${brief} ${theme}`,
    });
    await createContentPost({
      organizationId: input.organizationId,
      platform: input.platform,
      imageUrls: [imageUrl],
      caption,
      hashtags,
      scheduledFor: input.scheduledFor,
    });
    return { success: true };
  } catch (error) {
    console.error("Content generation failed", error);
    return { success: false };
  }
}
