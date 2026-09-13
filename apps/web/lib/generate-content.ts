import {
  countContentPosts,
  createContentPost,
  getBrandCreativeProfile,
  getBrandProfile,
  type Platform,
} from "@socialpilot/db";
import { asStringArray } from "./brand-fields";
import { buildImagePrompt } from "./brand-prompt";
import { fetchImageBuffer } from "./fetch-image";
import { generateCaption, generateImage } from "./openai";
import { createStoryImage } from "./story-image";
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

// A second, independent axis of variety (composition/lighting/setting)
// cycled alongside CONTENT_THEMES. Deliberately not a multiple of
// CONTENT_THEMES.length (7) so the two only repeat the same *combination*
// once every 7*11 = 77 posts, even though each cycles on its own.
export const CONTENT_TREATMENTS = [
  "Shot as a close-up, shallow depth of field.",
  "Overhead flat-lay composition on a styled surface.",
  "Wide shot showing the product in its surroundings.",
  "Bright, airy natural daylight setting.",
  "Moody, dramatic lighting with strong shadows.",
  "Candid lifestyle scene with the product being enjoyed.",
  "Minimalist studio shot on a clean, simple background.",
  "Dynamic angle capturing movement or action.",
  "Warm, cozy, golden-hour lighting.",
  "Editorial-style composition with generous negative space.",
  "Rustic, textured setting emphasizing natural materials.",
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
  // Falls back to how many posts this org already has, rather than
  // literally 0, so two posts triggered independently (e.g. a one-time
  // date add followed by a schedule slot add) don't both land on the same
  // "first" theme and end up looking like near-duplicates.
  const resolvedIndex = input.themeIndex ?? (await countContentPosts(input.organizationId));
  const theme = CONTENT_THEMES[resolvedIndex % CONTENT_THEMES.length];
  const treatment = CONTENT_TREATMENTS[resolvedIndex % CONTENT_TREATMENTS.length];
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
        `${theme} ${treatment} Consistent with the brand's established visual style.`,
      ),
      referenceImages,
    });
    const imageUrl = await uploadGeneratedImage(input.organizationId, imageBuffer);

    // Best-effort: the post itself is the primary deliverable, so a
    // failure here shouldn't block it - it just means this post won't
    // also go out as a Story.
    let storyImageUrl: string | undefined;
    try {
      const storyBuffer = await createStoryImage(imageBuffer);
      storyImageUrl = await uploadGeneratedImage(input.organizationId, storyBuffer, "stories");
    } catch (error) {
      console.error("Generating the Story-format version of the image failed", error);
    }

    const { caption, hashtags } = await generateCaption({
      businessName: brandProfile.businessName,
      tone: brandProfile.tone ?? undefined,
      brief: `${brief} ${theme}`,
    });
    await createContentPost({
      organizationId: input.organizationId,
      platform: input.platform,
      imageUrls: [imageUrl],
      storyImageUrl,
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
