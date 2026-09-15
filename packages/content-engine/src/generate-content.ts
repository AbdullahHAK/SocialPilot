import {
  countGeneratedContentJobs,
  findMasterImageForDay,
  getBrandCreativeProfile,
  getBrandProfile,
  getLocalDayBoundsUtc,
  getMonthlyImageUsage,
  getPublishingSchedule,
  getRecentJobCreativeMetadata,
  markContentJobGenerated,
  MONTHLY_TOTAL_IMAGE_CAP,
  withDayImageLock,
  type ContentJob,
} from "@socialpilot/db";
import { asStringArray } from "./brand-fields";
import { buildContentPrompt, type CreativeVariation } from "./brand-prompt";
import { isBrandSetupComplete } from "./brand-setup";
import { fetchImageBuffer } from "./fetch-image";
import { generateCaption, generateImage, type BrandStyleProfile } from "./openai";
import { createStoryImage } from "./story-image";
import { uploadGeneratedImage } from "./storage";

// Seven independent variety axes, each cycled by the same ever-increasing
// job index but with pairwise-distinct array lengths (4,5,6,7,8,9,11) so
// no two axes stay "locked" to the same relative position and the full
// combination doesn't repeat for thousands of posts. Per the client's
// explicit request for much finer-grained, deliberate variation across
// subject, camera angle, camera distance, composition, environment, and
// lighting - not just a different caption angle on a similar-looking photo.
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

export function resolveVariation(index: number): CreativeVariation {
  // Non-null: index % array.length is always a valid in-bounds index into
  // that same array.
  return {
    contentTheme: CONTENT_THEMES[index % CONTENT_THEMES.length]!,
    subject: SUBJECTS[index % SUBJECTS.length]!,
    cameraAngle: CAMERA_ANGLES[index % CAMERA_ANGLES.length]!,
    cameraDistance: CAMERA_DISTANCES[index % CAMERA_DISTANCES.length]!,
    composition: COMPOSITIONS[index % COMPOSITIONS.length]!,
    environment: ENVIRONMENTS[index % ENVIRONMENTS.length]!,
    lighting: LIGHTING_STYLES[index % LIGHTING_STYLES.length]!,
  };
}

/** Thrown when a fresh generation would exceed the org's monthly image
 * cap - deliberately distinct from a generic generation failure so the
 * caller (apps/worker/src/generator.ts) can cancel rather than retry: the
 * cap won't lift again until next month, so retrying on the usual 60s
 * cadence would just waste attempts. Checked only once we already know a
 * fresh generation is actually needed (after the same-day-reuse check),
 * so a zero-cost reuse is never wrongly blocked by this cap. */
export class MonthlyImageCapReachedError extends Error {
  constructor() {
    super(`Monthly image generation limit reached (${MONTHLY_TOTAL_IMAGE_CAP})`);
    this.name = "MonthlyImageCapReachedError";
  }
}

export function parseStyleProfile(value: unknown): BrandStyleProfile | null {
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

/**
 * Generates (or reuses) the one shared master creative for a ContentJob -
 * the direct fix for the client's original complaint that Instagram and
 * Facebook could end up with different AI images for what was meant to be
 * one scheduled post. Called by apps/worker's generation cycle only after
 * it has already claimed the job (CAS PENDING/RETRYING -> GENERATING) and
 * re-verified the org's subscription/brand/schedule are still ready -
 * this function assumes that's already true and just produces the
 * creative; it still throws (rather than silently no-op-ing) if the brand
 * turns out incomplete, so a narrow race between that check and this call
 * surfaces as a normal generation failure/retry instead of a silent gap.
 *
 * On success, writes the result onto the job and marks it READY. Never
 * writes a caption per platform - one job means one caption, generated
 * once here and published identically everywhere the job targets.
 */
export async function generateContentForJob(job: ContentJob): Promise<void> {
  const [creativeProfile, brandProfile, schedule] = await Promise.all([
    getBrandCreativeProfile(job.organizationId),
    getBrandProfile(job.organizationId),
    getPublishingSchedule(job.organizationId),
  ]);

  if (!isBrandSetupComplete(brandProfile, creativeProfile) || !brandProfile) {
    throw new Error("Brand setup is no longer complete");
  }

  const brief = creativeProfile!.promptTemplateAdditions ?? "on-brand social media content";
  const resolvedIndex = await countGeneratedContentJobs(job.organizationId);
  const variation = resolveVariation(resolvedIndex);
  const theme = variation.contentTheme;

  const { caption, hashtags } = await generateCaption({
    businessName: brandProfile.businessName,
    tone: brandProfile.tone ?? undefined,
    brief: `${brief} ${theme}`,
  });

  const { start, end } = getLocalDayBoundsUtc(job.scheduledFor, schedule.timezone);

  // The whole "does today already have an image? if not, make one" check
  // is serialized per org+day behind a database lock - two different
  // jobs on the same calendar day (not two platforms on the *same* job,
  // which can no longer race each other by construction) could otherwise
  // both see "nothing yet" and both pay for a fresh AI generation. Once an
  // image exists for the day, it's reused unconditionally for the rest of
  // that day - even a Brand Settings edit in between doesn't force a new
  // one (see findMasterImageForDay for why: that used to be exploitable
  // as a free-regeneration loophole). The edit still takes effect - just
  // starting the next calendar day, not retroactively.
  await withDayImageLock(job.organizationId, start.toISOString(), async (db) => {
    const existingDayImage = await findMasterImageForDay(job.organizationId, start, end, db);
    if (existingDayImage) {
      // Written inside the same locked transaction that read it, so this
      // reuse decision and the write it's based on stay consistent even
      // under concurrent same-day jobs.
      await markContentJobGenerated(
        job.id,
        {
          masterImageUrl: existingDayImage.masterImageUrl,
          storyImageUrl: existingDayImage.storyImageUrl ?? undefined,
          caption,
          hashtags,
        },
        db,
      );
      return;
    }

    // Only checked once we know this call would actually spend a fresh
    // generation - a same-day reuse (handled above) costs nothing and
    // must never be blocked by this cap.
    const usage = await getMonthlyImageUsage(job.organizationId);
    if (usage.total >= MONTHLY_TOTAL_IMAGE_CAP) {
      throw new MonthlyImageCapReachedError();
    }

    const brandContext = {
      businessName: brandProfile.businessName,
      category: brandProfile.category,
      tone: brandProfile.tone,
      description: brandProfile.description,
      colors: asStringArray(brandProfile.colors),
    };

    // Only the logo goes in as an image reference - the approved concept
    // photo is deliberately NOT included. Passing it as an edit reference
    // anchored composition, camera angle, and subject far more than
    // intended. Its visual STYLE is captured in styleDescriptors and given
    // as text guidance instead - brand-consistent without being a template.
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

    const styleProfile = parseStyleProfile(creativeProfile!.styleDescriptors);
    const recentMetadata = await getRecentJobCreativeMetadata(job.organizationId, 3);

    // Square (1:1) - safely inside Instagram's accepted post aspect ratio
    // range as-is, so the post goes out exactly as the model made it, with
    // no cropping that could cut into text, a logo, or the subject itself.
    const masterImage = await generateImage({
      prompt: buildContentPrompt(brief, brandContext, styleProfile, variation, recentMetadata),
      referenceImages,
    });
    const masterImageUrl = await uploadGeneratedImage(job.organizationId, masterImage);
    const creativeMetadata = { ...variation, language: brandProfile.language };

    // Best-effort: a Story-format failure shouldn't block the main
    // creative - it just means this job won't also have a Story crop.
    let storyImageUrl: string | undefined;
    try {
      const storyBuffer = await createStoryImage(masterImage);
      storyImageUrl = await uploadGeneratedImage(job.organizationId, storyBuffer, "stories");
    } catch (error) {
      console.error("Generating the Story-format version of the image failed", error);
    }

    // Written inside the lock (not after it releases) - this is what
    // makes the write visible to any other job racing for the same
    // calendar day the instant this transaction commits, closing the
    // exact race window withDayImageLock exists to prevent.
    await markContentJobGenerated(
      job.id,
      { masterImageUrl, storyImageUrl, caption, hashtags, creativeMetadata },
      db,
    );
  });
}
