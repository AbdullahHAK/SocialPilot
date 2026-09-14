import {
  countContentPosts,
  createContentPost,
  findImageForDay,
  getBrandCreativeProfile,
  getBrandProfile,
  getPublishingSchedule,
  getRecentCreativeMetadata,
  withDayImageLock,
  type Platform,
} from "@socialpilot/db";
import { asStringArray } from "./brand-fields";
import { buildContentPrompt, type CreativeVariation } from "./brand-prompt";
import { fetchImageBuffer } from "./fetch-image";
import { generateCaption, generateImage, type BrandStyleProfile } from "./openai";
import { createStoryImage } from "./story-image";
import { uploadGeneratedImage } from "./storage";
import { getLocalDayBoundsUtc } from "./timezone";

// Seven independent variety axes, each cycled by the same ever-increasing
// call index but with pairwise-distinct array lengths (4,5,6,7,8,9,11) so
// no two axes stay "locked" to the same relative position and the full
// combination doesn't repeat for thousands of posts. This replaced a
// simpler 2-axis (theme x treatment) system per the client's explicit
// request for much finer-grained, deliberate variation across subject,
// camera angle, camera distance, composition, environment, and lighting -
// not just a different caption angle on a similar-looking photo.
export const CONTENT_THEMES = [
  "Focus on the standout quality and craftsmanship of the product.",
  "Highlight the business's most popular, best-selling item.",
  "Focus on general brand awareness - what makes this business memorable, not a specific product.",
  "Showcase how the product is presented and served, an appetizing close-up.",
  "Highlight a special offer or promotion in broad terms, without inventing a specific price.",
  "Center the content on the customer experience and enjoyment of the brand.",
  "Focus on the brand's atmosphere and personality rather than one specific product.",
] as const;

export const SUBJECTS = [
  "The product itself as the clear hero of the shot.",
  "A person actively using, holding, or enjoying the product.",
  "The making or preparation process, mid-action.",
  "The storefront, workspace, or business environment itself.",
  "A close, textural detail of the product or material.",
  "Multiple items or a display arranged together.",
] as const;

export const CAMERA_ANGLES = [
  "Eye-level, shot straight-on.",
  "Low angle, looking upward.",
  "High angle, looking downward.",
  "Three-quarter angle from the side.",
  "Over-the-shoulder viewpoint.",
] as const;

export const CAMERA_DISTANCES = [
  "Extreme close-up on fine detail.",
  "Close-up framing.",
  "Medium shot with some surroundings visible.",
  "Wide shot establishing the full scene.",
] as const;

export const COMPOSITIONS = [
  "Centered, symmetrical framing.",
  "Rule-of-thirds, subject off-center.",
  "Overhead flat-lay composition.",
  "Framed through foreground elements.",
  "Generous negative space around the subject.",
  "Dynamic diagonal composition.",
  "Layered composition with visible depth.",
  "Tightly cropped, filling the frame.",
  "Repeating pattern or grid-like arrangement.",
] as const;

export const ENVIRONMENTS = [
  "Inside the business's own space.",
  "Outdoors in natural surroundings.",
  "Clean, minimal studio background.",
  "A lifestyle setting where it's being used or enjoyed.",
  "A styled tabletop or surface setting.",
  "An urban street or city backdrop.",
  "A cozy, homey indoor setting.",
  "A rustic, natural-materials setting.",
  "A bright, airy open space.",
  "A bustling, energetic environment with people.",
  "A quiet, intimate, close environment.",
] as const;

export const LIGHTING_STYLES = [
  "Bright, natural daylight.",
  "Warm, golden-hour light.",
  "Moody, dramatic shadows.",
  "Soft, diffused studio light.",
  "High-contrast, direct light.",
  "Ambient, warm interior lighting.",
  "Cool-toned, crisp lighting.",
  "Backlit, with a glowing rim of light.",
] as const;

function resolveVariation(index: number): CreativeVariation {
  return {
    contentTheme: CONTENT_THEMES[index % CONTENT_THEMES.length],
    subject: SUBJECTS[index % SUBJECTS.length],
    cameraAngle: CAMERA_ANGLES[index % CAMERA_ANGLES.length],
    cameraDistance: CAMERA_DISTANCES[index % CAMERA_DISTANCES.length],
    composition: COMPOSITIONS[index % COMPOSITIONS.length],
    environment: ENVIRONMENTS[index % ENVIRONMENTS.length],
    lighting: LIGHTING_STYLES[index % LIGHTING_STYLES.length],
  };
}

function parseStyleProfile(value: unknown): BrandStyleProfile | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Partial<BrandStyleProfile>;
  return {
    colors: Array.isArray(v.colors) ? v.colors.filter((c): c is string => typeof c === "string") : [],
    typographyDirection: v.typographyDirection ?? "",
    logoUsage: v.logoUsage ?? "",
    photographyStyle: v.photographyStyle ?? "",
    lightingStyle: v.lightingStyle ?? "",
    visualQuality: v.visualQuality ?? "",
    brandPersonality: v.brandPersonality ?? "",
    designAesthetic: v.designAesthetic ?? "",
  };
}

export interface GenerateAndScheduleInput {
  organizationId: string;
  platform: Platform;
  scheduledFor: Date;
  themeIndex?: number;
}

/**
 * Schedules one on-brand ContentPost, generating a fresh AI image only
 * when the org doesn't already have one for that calendar day - the
 * client's explicit, "very strict" cost rule is at most one AI image
 * generation per organization per day, no matter how many platforms or
 * posts are scheduled that day. Everything else (a second platform, a
 * second time slot the same day) reuses that same day's image and Story
 * crop; only the caption is generated per call, since text is cheap and
 * keeping it distinct per post/platform is still worth doing.
 *
 * Requires an approved creative style and logo - returns
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

  const schedule = await getPublishingSchedule(input.organizationId);

  const brief = creativeProfile.promptTemplateAdditions ?? "on-brand social media content";
  // Falls back to how many posts this org already has, rather than
  // literally 0, so two posts triggered independently (e.g. a one-time
  // date add followed by a schedule slot add) don't both land on the same
  // "first" combination and end up looking like near-duplicates.
  const resolvedIndex = input.themeIndex ?? (await countContentPosts(input.organizationId));
  const variation = resolveVariation(resolvedIndex);
  // Kept for the caption, which still benefits from a short theme phrase.
  const theme = variation.contentTheme;

  try {
    const { start, end } = getLocalDayBoundsUtc(input.scheduledFor, schedule.timezone);

    const { caption, hashtags } = await generateCaption({
      businessName: brandProfile.businessName,
      tone: brandProfile.tone ?? undefined,
      brief: `${brief} ${theme}`,
    });

    // The whole "does today already have an image? if not, make one" check
    // is serialized per org+day behind a database lock - without it, two
    // requests landing close together (a double-click, a retry, two
    // platforms submitted at once) can both see "nothing yet" and both pay
    // for a fresh AI generation, which happened in production. A losing
    // request blocks until the winner commits, then finds and reuses its
    // image instead of racing ahead to generate its own.
    await withDayImageLock(input.organizationId, start.toISOString(), async (db) => {
      const dayImage = await findImageForDay(input.organizationId, start, end, db);

      // A cached day-image only counts if it was generated *after* the
      // brand/creative profile's last edit - otherwise a business
      // corrected mid-setup (e.g. placeholder test info replaced with the
      // real brand) would keep having its old, now-wrong-brand image
      // reused for the rest of that calendar day, which is worse than one
      // extra generation.
      const existingDayImage =
        dayImage &&
        dayImage.createdAt > brandProfile.updatedAt &&
        dayImage.createdAt > creativeProfile.updatedAt
          ? dayImage
          : null;

      let imageUrl: string;
      let storyImageUrl: string | undefined;
      let creativeMetadata: object | undefined;

      if (existingDayImage) {
        imageUrl = existingDayImage.imageUrl;
        storyImageUrl = existingDayImage.storyImageUrl ?? undefined;
      } else {
        const brandContext = {
          businessName: brandProfile.businessName,
          category: brandProfile.category,
          tone: brandProfile.tone,
          description: brandProfile.description,
          colors: asStringArray(brandProfile.colors),
        };

        // Only the logo goes in as an image reference now - the approved
        // concept photo is deliberately NOT included here. Passing it as
        // an edit reference anchored composition, camera angle, and
        // subject far more than intended (the client's exact complaint:
        // posts came out looking like copies of the approved image). Its
        // visual STYLE is captured in styleDescriptors (see
        // analyzeBrandStyle) and given as text guidance instead - brand-
        // consistent without being a template.
        const referenceImages = brandProfile.logoUrl
          ? await (async () => {
              try {
                return [await fetchImageBuffer(brandProfile.logoUrl!)];
              } catch (error) {
                console.error("Fetching the logo reference image failed", error);
                return [];
              }
            })()
          : [];

        const styleProfile = parseStyleProfile(creativeProfile.styleDescriptors);
        const recentMetadata = await getRecentCreativeMetadata(input.organizationId, 3);

        // Square (1:1) - safely inside Instagram's accepted post aspect
        // ratio range (4:5 to 1.91:1) as-is, so the post goes out exactly
        // as the model made it, with no cropping that could cut into
        // text, a logo, or the subject itself (the client's explicit
        // complaint about an earlier, taller size that got center-cropped
        // for the post).
        const masterImage = await generateImage({
          prompt: buildContentPrompt(brief, brandContext, styleProfile, variation, recentMetadata),
          referenceImages,
        });
        imageUrl = await uploadGeneratedImage(input.organizationId, masterImage);
        creativeMetadata = { ...variation, language: brandProfile.language };

        // Best-effort: the post itself is the primary deliverable, so a
        // failure here shouldn't block it - it just means this post won't
        // also go out as a Story. Built from the same untouched master
        // image (not a cropped copy) - createStoryImage letterboxes it
        // into the 9:16 frame rather than cropping, so nothing is cut
        // here either.
        try {
          const storyBuffer = await createStoryImage(masterImage);
          storyImageUrl = await uploadGeneratedImage(input.organizationId, storyBuffer, "stories");
        } catch (error) {
          console.error("Generating the Story-format version of the image failed", error);
        }
      }

      await createContentPost(
        {
          organizationId: input.organizationId,
          platform: input.platform,
          imageUrls: [imageUrl],
          storyImageUrl,
          creativeMetadata,
          caption,
          hashtags,
          scheduledFor: input.scheduledFor,
        },
        db,
      );
    });

    return { success: true };
  } catch (error) {
    console.error("Content generation failed", error);
    return { success: false };
  }
}
