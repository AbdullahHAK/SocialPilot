"use server";

import { getBrandCreativeProfile, getBrandProfile, getPublishingSchedule } from "@socialpilot/db";
import { redirect } from "next/navigation";
import { generateAndScheduleContent } from "@/lib/generate-content";
import { computeUpcomingSlotOccurrences } from "@/lib/schedule-dates";
import { getSession } from "@/lib/session";

// Bounded so a single click stays fast and inexpensive during testing; the
// periodic content-generation job (api/cron/generate-content) is what
// actually keeps things running day to day now, generating only a couple
// of days ahead at a time rather than committing to a whole month upfront
// - if a customer cancels, at most a couple of days of images are wasted,
// not sixty.
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

  if (!creativeProfile || !brandProfile?.logoUrl) {
    redirect("/dashboard/create");
  }

  const enabledSlots = schedule.slots.filter((slot) => slot.enabled);
  if (enabledSlots.length === 0) {
    redirect("/dashboard/style?error=no_slots");
  }

  const occurrences = computeUpcomingSlotOccurrences(enabledSlots, {
    days: 30,
  }).slice(0, MAX_POSTS_PER_GENERATION);

  let count = 0;
  for (const [index, occurrence] of occurrences.entries()) {
    const result = await generateAndScheduleContent({
      organizationId: session.organizationId,
      platform: occurrence.platform,
      scheduledFor: occurrence.date,
      themeIndex: index,
    });
    if (result.success) count++;
  }

  redirect(`/dashboard/style?generated=${count}`);
}
