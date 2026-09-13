"use server";

import { deleteContentPost, setPublishingScheduleTimezone, updateContentPost } from "@socialpilot/db";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { zonedTimeToUtc } from "@/lib/timezone";
import { editContentPostSchema, timezoneSchema } from "@/lib/validation";

function parseTimezone(value: FormDataEntryValue | null): string {
  const parsed = timezoneSchema.safeParse(value);
  return parsed.success ? parsed.data : "UTC";
}

export interface EditContentPostResult {
  ok: boolean;
}

export async function editContentPostAction(
  formData: FormData,
): Promise<EditContentPostResult> {
  const session = await getSession();
  if (!session) return { ok: false };

  const postId = formData.get("postId");
  if (typeof postId !== "string") return { ok: false };

  const parsed = editContentPostSchema.safeParse({
    caption: formData.get("caption"),
    date: formData.get("date"),
    time: formData.get("time"),
  });
  if (!parsed.success) return { ok: false };

  const timezone = parseTimezone(formData.get("timezone"));
  await setPublishingScheduleTimezone(session.organizationId, timezone);

  const [year, month, day] = parsed.data.date.split("-").map(Number);
  const [hour, minute] = parsed.data.time.split(":").map(Number);
  const scheduledFor = zonedTimeToUtc({ year, month, day, hour, minute }, timezone);

  const updated = await updateContentPost(session.organizationId, postId, {
    caption: parsed.data.caption,
    scheduledFor,
  });
  if (!updated) return { ok: false };

  revalidatePath("/dashboard/calendar");
  return { ok: true };
}

export async function deleteContentPostAction(formData: FormData) {
  const session = await getSession();
  if (!session) return;

  const postId = formData.get("postId");
  if (typeof postId !== "string") return;

  await deleteContentPost(session.organizationId, postId);
  revalidatePath("/dashboard/calendar");
}
