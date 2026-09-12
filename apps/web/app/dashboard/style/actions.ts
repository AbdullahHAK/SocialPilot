"use server";

import {
  createContentPost,
  getBrandCreativeProfile,
  getBrandProfile,
  getPublishingSchedule,
} from "@socialpilot/db";
import { redirect } from "next/navigation";
import { asStringArray } from "@/lib/brand-fields";
import { buildImagePrompt } from "@/lib/brand-prompt";
import { fetchImageBuffer } from "@/lib/fetch-image";
import { generateCaption, generateImage } from "@/lib/openai";
import { computeUpcomingSlotOccurrences } from "@/lib/schedule-dates";
import { getSession } from "@/lib/session";
import { uploadGeneratedImage } from "@/lib/storage";

// Bounded so a single click stays fast and inexpensive during testing; a
// full month of daily content is the same code path, just a bigger slice.
const MAX_POSTS_PER_GENERATION = 8;

// Cycled by post index so a run of daily/weekly content doesn't repeat the
// same angle every time, even though it's the same approved visual style -
// matches the client's "quality today, bestseller tomorrow" request.
const CONTENT_THEMES = [
  "Focus on the standout quality and craftsmanship of the product.",
  "Highlight the business's most popular, best-selling item.",
  "Focus on general brand awareness - what makes this business memorable, not a specific product.",
  "Showcase how the product is presented and served, an appetizing close-up.",
  "Highlight a special offer or promotion in broad terms, without inventing a specific price.",
  "Center the content on the customer experience and enjoyment of the brand.",
  "Focus on the brand's atmosphere and personality rather than one specific product.",
] as const;

export async function generateMonthlyContentAction() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const [creativeProfile, brandProfile, schedule] = await Promise.all([
    getBrandCreativeProfile(session.organizationId),
    getBrandProfile(session.organizationId),
    getPublishingSchedule(session.organizationId),
  ]);

  if (!creativeProfile) {
    redirect("/dashboard/create");
  }

  const enabledSlots = schedule.slots.filter((slot) => slot.enabled);
  if (enabledSlots.length === 0) {
    redirect("/dashboard/style?error=no_slots");
  }

  const occurrences = computeUpcomingSlotOccurrences(enabledSlots, {
    days: 30,
  }).slice(0, MAX_POSTS_PER_GENERATION);

  const brief = creativeProfile.promptTemplateAdditions ?? "on-brand social media content";
  const brandContext = brandProfile && {
    businessName: brandProfile.businessName,
    category: brandProfile.category,
    tone: brandProfile.tone,
    description: brandProfile.description,
    colors: asStringArray(brandProfile.colors),
  };

  // Reused for every post in this batch so the visual style actually stays
  // consistent (not just prompted to) - the approved concept image anchors
  // the look, the logo keeps brand identity intact across every post.
  const referenceUrls = [
    creativeProfile.referenceImageUrls[0],
    brandProfile?.logoUrl,
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

  let count = 0;
  for (const [index, occurrence] of occurrences.entries()) {
    const theme = CONTENT_THEMES[index % CONTENT_THEMES.length];
    try {
      const imageBuffer = await generateImage({
        prompt: buildImagePrompt(
          brief,
          brandContext,
          `${theme} Consistent with the brand's established visual style.`,
        ),
        referenceImages,
      });
      const imageUrl = await uploadGeneratedImage(
        session.organizationId,
        imageBuffer,
      );
      const { caption, hashtags } = await generateCaption({
        businessName: brandProfile?.businessName ?? "the business",
        tone: brandProfile?.tone ?? undefined,
        brief: `${brief} ${theme}`,
      });
      await createContentPost({
        organizationId: session.organizationId,
        platform: occurrence.platform,
        imageUrls: [imageUrl],
        caption,
        hashtags,
        scheduledFor: occurrence.date,
      });
      count++;
    } catch (error) {
      console.error("Monthly content generation: one post failed", error);
    }
  }

  redirect(`/dashboard/style?generated=${count}`);
}
