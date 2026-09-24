import {
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
import { buildContentPrompt } from "./brand-prompt";
import { isBrandSetupComplete } from "./brand-setup";
import { fetchImageBuffer } from "./fetch-image";
import {
  generateCaption,
  generateImage,
  planCreativeConcept,
  type BrandStyleProfile,
  type StoryArchetype,
} from "./openai";
import { createStoryImage } from "./story-image";
import { uploadGeneratedImage } from "./storage";

// Universal story categories, not tied to any one business type - the
// client's explicit request was real creative variety (a different scene
// and story each time, not just a different camera angle on the same kind
// of shot), adapted per business automatically rather than a maintained
// list of prompts per industry. This list only guarantees the *category*
// of story doesn't repeat too soon (see resolveStoryArchetype) - the
// actual business-specific scene within it is invented by
// planCreativeConcept (openai.ts), which is where the real creativity and
// industry-awareness comes from.
export const STORY_ARCHETYPES: readonly StoryArchetype[] = [
  { key: "social", label: "A social gathering - friends, family, or coworkers sharing the moment together." },
  { key: "solo", label: "A solo, close-up moment - one person genuinely enjoying or using it." },
  { key: "process", label: "Behind-the-scenes or the making/preparation process." },
  { key: "service", label: "A delivery, service, or hands-on moment of the business in action." },
  { key: "location", label: "An outdoor, distinctive, or unexpected location setting." },
  { key: "celebration", label: "A celebration or milestone moment." },
  { key: "testimonial", label: "A customer-testimonial style close-up, as if someone is sharing why they love it." },
  { key: "unexpected", label: "An unexpected, playful, or humorous take." },
  { key: "community", label: "A community or local-life moment connected to the business." },
  { key: "dayInLife", label: "A day-in-the-life moment showing it naturally fitting into someone's day." },
] as const;

/** Picks the next story category at random, excluding whichever ones
 * `recentMetadata` shows were used recently - the same guaranteed-rotation
 * mechanism the old per-axis system used (see git history), now aimed at
 * the story itself rather than just camera-technical details, which is
 * what customers actually meant by "the images all look similar." */
export function resolveStoryArchetype(recentMetadata: object[]): StoryArchetype {
  const recentKeys = new Set(
    (recentMetadata as Partial<{ archetype: string }>[])
      .map((m) => m.archetype)
      .filter((v): v is string => typeof v === "string"),
  );
  const candidates = STORY_ARCHETYPES.filter((a) => !recentKeys.has(a.key));
  // Once every category has been used recently, fall back to the full
  // list rather than get stuck.
  const pool = candidates.length > 0 ? candidates : STORY_ARCHETYPES;
  return pool[Math.floor(Math.random() * pool.length)]!;
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
      // A reused image needs no new creative concept - it's the same
      // picture again - just a fresh caption, same as always.
      const { caption, hashtags } = await generateCaption({
        businessName: brandProfile.businessName,
        tone: brandProfile.tone ?? undefined,
        brief,
      });
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
    const styleProfile = parseStyleProfile(creativeProfile!.styleDescriptors);

    // 10 (not just the last 2-3) so a short list like STORY_ARCHETYPES
    // (10 categories) doesn't start repeating within two weeks of daily
    // posts, and so the creative director has real recent scenes to
    // avoid, not just a category label.
    const recentMetadata = await getRecentJobCreativeMetadata(job.organizationId, 10);
    const archetype = resolveStoryArchetype(recentMetadata);
    const recentScenes = (recentMetadata as Partial<{ scene: string }>[])
      .map((m) => m.scene)
      .filter((s): s is string => typeof s === "string" && s.length > 0);

    const concept = await planCreativeConcept({
      businessName: brandContext.businessName,
      category: brandContext.category,
      description: brandContext.description,
      tone: brandContext.tone,
      colors: brandContext.colors ?? undefined,
      styleProfile,
      archetype,
      brief,
      recentScenes,
    });

    const { caption, hashtags } = await generateCaption({
      businessName: brandProfile.businessName,
      tone: brandProfile.tone ?? undefined,
      brief: `${brief} ${concept.storyIdea}`,
    });

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

    // Square (1:1) - safely inside Instagram's accepted post aspect ratio
    // range as-is, so the post goes out exactly as the model made it, with
    // no cropping that could cut into text, a logo, or the subject itself.
    const masterImage = await generateImage({
      prompt: buildContentPrompt(brief, brandContext, styleProfile, concept),
      referenceImages,
    });
    const masterImageUrl = await uploadGeneratedImage(job.organizationId, masterImage);
    const creativeMetadata = { archetype: archetype.key, ...concept, language: brandProfile.language };

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
