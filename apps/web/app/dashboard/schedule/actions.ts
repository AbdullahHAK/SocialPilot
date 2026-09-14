"use server";

import {
  addScheduleSlot,
  deleteScheduleSlot,
  ensurePublishingScheduleTimezone,
  getBrandCreativeProfile,
  getBrandProfile,
  materializeContentJob,
  updateScheduleSlot,
  zonedTimeToUtc,
  type Platform,
} from "@socialpilot/db";
import { isBrandSetupComplete } from "@socialpilot/content-engine";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { oneTimePostSchema, scheduleSlotSchema, timezoneSchema } from "@/lib/validation";

/** A submitted timezone always comes from the browser's own
 * Intl.DateTimeFormat, so it should already be valid - this is just
 * defense in depth against a missing/garbled field, falling back to UTC
 * (the previous, always-correct-for-UTC-orgs behavior) rather than
 * throwing. */
function parseTimezone(value: FormDataEntryValue | null): string {
  const parsed = timezoneSchema.safeParse(value);
  return parsed.success ? parsed.data : "UTC";
}

export async function addScheduleSlotAction(formData: FormData) {
  const session = await getSession();
  if (!session) return;

  const timezone = parseTimezone(formData.get("timezone"));
  await ensurePublishingScheduleTimezone(session.organizationId, timezone);

  // One time can be applied to several days and/or both platforms at once
  // (the "repeat on these days" pattern from alarm apps, extended to
  // platforms too) - a plain <form> naturally collects multiple
  // same-named fields via getAll, one per checked day/platform.
  const days = formData.getAll("dayOfWeek");
  const time = formData.get("time");
  const platforms = formData.getAll("platform");

  for (const dayOfWeek of days) {
    for (const platform of platforms) {
      const parsed = scheduleSlotSchema.safeParse({ dayOfWeek, time, platform });
      if (!parsed.success) continue;

      await addScheduleSlot({
        organizationId: session.organizationId,
        ...parsed.data,
      });
    }
  }
  // No eager generation here anymore - the worker's materialize cycle picks
  // up this slot's occurrences within a few minutes on its own, and actual
  // AI generation only starts ~5 minutes before each occurrence's time (the
  // client's explicit requirement: never generate content days or hours
  // ahead of when it's actually needed).
  revalidatePath("/dashboard/schedule");
}

export async function toggleScheduleSlotAction(formData: FormData) {
  const session = await getSession();
  if (!session) return;

  const slotId = formData.get("slotId");
  const currentlyEnabled = formData.get("enabled") === "true";
  if (typeof slotId !== "string") return;

  await updateScheduleSlot(session.organizationId, slotId, {
    enabled: !currentlyEnabled,
  });
  revalidatePath("/dashboard/schedule");
}

export interface OneTimePostResult {
  ok: boolean;
  reason?: "not_ready" | "invalid";
}

/** Schedules a post for one specific calendar date on one or both
 * platforms at once, bypassing the recurring weekly slots entirely - for
 * "just this one day" instead of "every Monday". Creates ONE ContentJob
 * covering every selected platform (never one per platform - that's what
 * used to let Instagram and Facebook end up with different AI images for
 * the same scheduled time) so it shows up on the Content Calendar right
 * away as "scheduled" - but does not generate anything itself; the actual
 * creative is produced by the worker's generation cycle ~5 minutes before
 * scheduledFor, same as every other job. */
export async function addOneTimePostAction(
  formData: FormData,
): Promise<OneTimePostResult> {
  const session = await getSession();
  if (!session) return { ok: false, reason: "invalid" };

  const date = formData.get("date");
  const time = formData.get("time");
  const platformValues = formData.getAll("platform");
  if (platformValues.length === 0) return { ok: false, reason: "invalid" };

  const [creativeProfile, brandProfile] = await Promise.all([
    getBrandCreativeProfile(session.organizationId),
    getBrandProfile(session.organizationId),
  ]);
  if (!isBrandSetupComplete(brandProfile, creativeProfile)) {
    return { ok: false, reason: "not_ready" };
  }

  const timezone = parseTimezone(formData.get("timezone"));
  await ensurePublishingScheduleTimezone(session.organizationId, timezone);

  const platforms: Platform[] = [];
  let parsedDate: string | undefined;
  let parsedTime: string | undefined;
  for (const platform of platformValues) {
    const parsed = oneTimePostSchema.safeParse({ date, time, platform });
    if (!parsed.success) continue;
    platforms.push(parsed.data.platform);
    parsedDate = parsed.data.date;
    parsedTime = parsed.data.time;
  }
  if (platforms.length === 0 || !parsedDate || !parsedTime) {
    return { ok: false, reason: "invalid" };
  }

  const [year, month, day] = parsedDate.split("-").map(Number);
  const [hour, minute] = parsedTime.split(":").map(Number);
  const scheduledFor = zonedTimeToUtc({ year, month, day, hour, minute }, timezone);

  await materializeContentJob({
    organizationId: session.organizationId,
    scheduledFor,
    platforms,
    origin: "ONE_TIME",
  });

  revalidatePath("/dashboard/calendar");
  return { ok: true };
}

export async function removeScheduleSlotAction(formData: FormData) {
  const session = await getSession();
  if (!session) return;

  const slotId = formData.get("slotId");
  if (typeof slotId !== "string") return;

  await deleteScheduleSlot(session.organizationId, slotId);
  revalidatePath("/dashboard/schedule");
}
