"use server";

import { addScheduleSlot, deleteScheduleSlot, updateScheduleSlot } from "@socialpilot/db";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { scheduleSlotSchema } from "@/lib/validation";

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

export async function removeScheduleSlotAction(formData: FormData) {
  const session = await getSession();
  if (!session) return;

  const slotId = formData.get("slotId");
  if (typeof slotId !== "string") return;

  await deleteScheduleSlot(session.organizationId, slotId);
  revalidatePath("/dashboard/schedule");
}
