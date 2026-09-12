"use server";

import {
  createContentPost,
  getBrandCreativeProfile,
  getBrandProfile,
  getPublishingSchedule,
} from "@socialpilot/db";
import { redirect } from "next/navigation";
import { generateCaption, generateImage } from "@/lib/openai";
import { computeUpcomingSlotOccurrences } from "@/lib/schedule-dates";
import { getSession } from "@/lib/session";
import { uploadGeneratedImage } from "@/lib/storage";

// Bounded so a single click stays fast and inexpensive during testing; a
// full month of daily content is the same code path, just a bigger slice.
const MAX_POSTS_PER_GENERATION = 8;

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
  const businessName = brandProfile?.businessName ?? "the business";

  let count = 0;
  for (const occurrence of occurrences) {
    try {
      const imageBuffer = await generateImage({
        prompt: `${brief}. Business: ${businessName}. Square, social-media-ready composition, professional photography quality, consistent with the brand's established visual style.`,
      });
      const imageUrl = await uploadGeneratedImage(
        session.organizationId,
        imageBuffer,
      );
      const { caption, hashtags } = await generateCaption({
        businessName,
        tone: brandProfile?.tone ?? undefined,
        brief,
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
