"use server";

import { addScheduleSlot, deleteScheduleSlot, updateScheduleSlot } from "@socialpilot/db";
import { revalidatePath } from "next/cache";
import { generateAndScheduleContent } from "@/lib/generate-content";
import {
  computeUpcomingSlotOccurrences,
  type ScheduleSlotLike,
} from "@/lib/schedule-dates";
import { getSession } from "@/lib/session";
import { scheduleSlotSchema } from "@/lib/validation";

/** Generates content for just one slot's immediate next occurrence -
 * whether that's 5 minutes away or a week away - so a newly added (or
 * re-enabled) slot doesn't have to wait for the once-daily batch job to
 * have something actually ready to publish. Silently does nothing if the
 * brand isn't ready yet (no approved style/logo) or generation fails; the
 * daily job will pick it up once it is. */
async function generateForImmediateOccurrence(
  organizationId: string,
  slot: ScheduleSlotLike,
) {
  const [occurrence] = computeUpcomingSlotOccurrences([slot], { days: 8 });
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

  const parsed = scheduleSlotSchema.safeParse({
    dayOfWeek: formData.get("dayOfWeek"),
    time: formData.get("time"),
    platform: formData.get("platform"),
  });
  if (!parsed.success) return;

  await addScheduleSlot({
    organizationId: session.organizationId,
    ...parsed.data,
  });
  await generateForImmediateOccurrence(session.organizationId, parsed.data);
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
    await generateForImmediateOccurrence(session.organizationId, {
      dayOfWeek: updated.dayOfWeek,
      time: updated.time,
      platform: updated.platform,
    });
  }
  revalidatePath("/dashboard/schedule");
}

export async function removeScheduleSlotAction(formData: FormData) {
  const session = await getSession();
  if (!session) return;

  const slotId = formData.get("slotId");
  if (typeof slotId !== "string") return;

  await deleteScheduleSlot(session.organizationId, slotId);
  revalidatePath("/dashboard/schedule");
}
