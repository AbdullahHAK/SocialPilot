"use server";

import {
  decryptToken,
  deleteContentPost,
  ensurePublishingScheduleTimezone,
  getContentPost,
  listSocialAccounts,
  updateContentPost,
} from "@socialpilot/db";
import { revalidatePath } from "next/cache";
import { updateFacebookPostCaption } from "@/lib/meta";
import { getSession } from "@/lib/session";
import { zonedTimeToUtc } from "@/lib/timezone";
import { editContentPostSchema, editPublishedPostSchema, timezoneSchema } from "@/lib/validation";

function parseTimezone(value: FormDataEntryValue | null): string {
  const parsed = timezoneSchema.safeParse(value);
  return parsed.success ? parsed.data : "UTC";
}

export interface EditContentPostResult {
  ok: boolean;
  /** Shown to the user after a successful save when something about the
   * edit didn't fully apply - e.g. Instagram not supporting caption edits
   * after publishing, or the live Facebook update failing. */
  note?: string;
}

export async function editContentPostAction(
  formData: FormData,
): Promise<EditContentPostResult> {
  const session = await getSession();
  if (!session) return { ok: false };

  const postId = formData.get("postId");
  if (typeof postId !== "string") return { ok: false };

  const existing = await getContentPost(session.organizationId, postId);
  if (!existing) return { ok: false };

  // A post that already went out can't be rescheduled - only its caption
  // is still meaningfully editable, and even then only Facebook's API
  // supports pushing that change to the live post.
  if (existing.status === "PUBLISHED") {
    const parsed = editPublishedPostSchema.safeParse({ caption: formData.get("caption") });
    if (!parsed.success) return { ok: false };

    const updated = await updateContentPost(session.organizationId, postId, {
      caption: parsed.data.caption,
    });
    if (!updated) return { ok: false };

    let note: string | undefined;
    if (updated.platform === "FACEBOOK" && updated.externalPostId) {
      const accounts = await listSocialAccounts(session.organizationId);
      const facebookAccount = accounts.find((account) => account.provider === "FACEBOOK");
      if (facebookAccount) {
        try {
          await updateFacebookPostCaption(
            decryptToken(facebookAccount.accessToken),
            updated.externalPostId,
            parsed.data.caption,
          );
        } catch (error) {
          console.error("Updating the live Facebook post caption failed", error);
          note = "Saved here, but couldn't update the caption on the live Facebook post.";
        }
      } else {
        note = "Saved here, but no connected Facebook account was found to update the live post.";
      }
    } else if (updated.platform === "INSTAGRAM") {
      note =
        "Instagram doesn't support editing a caption after it's published, so this only updates your record here.";
    }

    revalidatePath("/dashboard/calendar");
    return { ok: true, note };
  }

  const parsed = editContentPostSchema.safeParse({
    caption: formData.get("caption"),
    date: formData.get("date"),
    time: formData.get("time"),
  });
  if (!parsed.success) return { ok: false };

  const timezone = parseTimezone(formData.get("timezone"));
  await ensurePublishingScheduleTimezone(session.organizationId, timezone);

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
