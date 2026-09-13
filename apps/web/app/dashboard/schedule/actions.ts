"use server";

import {
  addScheduleSlot,
  deleteScheduleSlot,
  getPublishingSchedule,
  setPublishingScheduleTimezone,
  updateScheduleSlot,
} from "@socialpilot/db";
import { revalidatePath } from "next/cache";
import { generateAndScheduleContent } from "@/lib/generate-content";
import {
  computeUpcomingSlotOccurrences,
  type ScheduleSlotLike,
} from "@/lib/schedule-dates";
import { getSession } from "@/lib/session";
import { zonedTimeToUtc } from "@/lib/timezone";
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

/** Generates content for just one slot's immediate next occurrence -
 * whether that's 5 minutes away or a week away - so a newly added (or
 * re-enabled) slot doesn't have to wait for the once-daily batch job to
 * have something actually ready to publish. Silently does nothing if the
 * brand isn't ready yet (no approved style/logo) or generation fails; the
 * daily job will pick it up once it is. */
async function generateForImmediateOccurrence(
  organizationId: string,
  slot: ScheduleSlotLike,
  timezone: string,
) {
  const [occurrence] = computeUpcomingSlotOccurrences([slot], { days: 8, timezone });
  if (!occurrence) return;

  try {
    await generateAndScheduleContent({
      organizationId,
      platform: occurrence.platform,
      scheduledFor: occurrence.date,
    });
  } catch (error) {
    console.error("Immediate content generation for a new slot failed", error);
  }
}

export async function addScheduleSlotAction(formData: FormData) {
  const session = await getSession();
  if (!session) return;

  const timezone = parseTimezone(formData.get("timezone"));
  await setPublishingScheduleTimezone(session.organizationId, timezone);

  // One time/platform can be applied to several days at once (the "repeat
  // on these days" pattern from alarm apps) - a plain <form> naturally
  // collects multiple same-named fields via getAll, one per checked day.
  const days = formData.getAll("dayOfWeek");
  const time = formData.get("time");
  const platform = formData.get("platform");

  for (const dayOfWeek of days) {
    const parsed = scheduleSlotSchema.safeParse({ dayOfWeek, time, platform });
    if (!parsed.success) continue;

    await addScheduleSlot({
      organizationId: session.organizationId,
      ...parsed.data,
    });
    await generateForImmediateOccurrence(session.organizationId, parsed.data, timezone);
  }
  revalidatePath("/dashboard/schedule");
}

export async function toggleScheduleSlotAction(formData: FormData) {
  const session = await getSession();
  if (!session) return;

  const slotId = formData.get("slotId");
  const currentlyEnabled = formData.get("enabled") === "true";
  if (typeof slotId !== "string") return;

  const updated = await updateScheduleSlot(session.organizationId, slotId, {
    enabled: !currentlyEnabled,
  });
  // Re-enabling a slot is just as likely to need content ready soon as
  // adding a brand new one.
  if (updated && !currentlyEnabled) {
    const schedule = await getPublishingSchedule(session.organizationId);
    await generateForImmediateOccurrence(
      session.organizationId,
      { dayOfWeek: updated.dayOfWeek, time: updated.time, platform: updated.platform },
      schedule.timezone,
    );
  }
  revalidatePath("/dashboard/schedule");
}

export interface OneTimePostResult {
  ok: boolean;
  reason?: "not_ready" | "invalid";
}

/** Schedules a single post for one specific calendar date, bypassing the
 * recurring weekly slots entirely - for "just this one day" instead of
 * "every Monday". Generates immediately, same as a new weekly slot does,
 * so it shows up on the Content Calendar right away rather than waiting
 * for the once-daily lookahead job. */
export async function addOneTimePostAction(
  formData: FormData,
): Promise<OneTimePostResult> {
  const session = await getSession();
  if (!session) return { ok: false, reason: "invalid" };

  const parsed = oneTimePostSchema.safeParse({
    date: formData.get("date"),
    time: formData.get("time"),
    platform: formData.get("platform"),
  });
  if (!parsed.success) return { ok: false, reason: "invalid" };

  const timezone = parseTimezone(formData.get("timezone"));
  await setPublishingScheduleTimezone(session.organizationId, timezone);

  const [year, month, day] = parsed.data.date.split("-").map(Number);
  const [hour, minute] = parsed.data.time.split(":").map(Number);
  const scheduledFor = zonedTimeToUtc({ year, month, day, hour, minute }, timezone);

  try {
    const result = await generateAndScheduleContent({
      organizationId: session.organizationId,
      platform: parsed.data.platform,
      scheduledFor,
    });
    revalidatePath("/dashboard/calendar");
    return result.success ? { ok: true } : { ok: false, reason: result.skipped };
  } catch (error) {
    console.error("One-time content generation failed", error);
    return { ok: false };
  }
}

export async function removeScheduleSlotAction(formData: FormData) {
  const session = await getSession();
  if (!session) return;

  const slotId = formData.get("slotId");
  if (typeof slotId !== "string") return;

  await deleteScheduleSlot(session.organizationId, slotId);
  revalidatePath("/dashboard/schedule");
}
