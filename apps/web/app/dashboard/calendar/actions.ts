"use server";

import {
  decryptToken,
  ensurePublishingScheduleTimezone,
  getBrandProfile,
  getContentJob,
  listSocialAccounts,
  removeContentJobPlatform,
  rescheduleContentJob,
  zonedTimeToUtc,
  type Platform,
} from "@socialpilot/db";
import { asStringArray, generateCaption } from "@socialpilot/content-engine";
import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { updateFacebookPostCaption } from "@/lib/meta";
import { getSession } from "@/lib/session";
import {
  createEditContentPostSchema,
  createEditPublishedPostSchema,
  createTimezoneSchema,
} from "@/lib/validation";

// The language SELECTed in onboarding/Brand Settings is stored as a short
// code (e.g. "fr"), but generateCaption's prompt wants a plain language
// name the model can follow as an instruction ("Write the caption in
// French") - this is the same fixed set already offered to customers in
// onboarding-wizard.tsx / brand-settings-form.tsx.
const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  ur: "Urdu",
  ar: "Arabic",
  es: "Spanish",
  fr: "French",
  hi: "Hindi",
  pt: "Portuguese",
  de: "German",
};

/** Turns a customer's free-text instruction into the actual caption -
 * shared by both the locked (already-published) and normal edit paths so
 * a manual re-caption always goes through the same brand-aware
 * generation as the rest of the product, rather than saving whatever was
 * typed verbatim. */
async function generateCaptionFromInstruction(organizationId: string, instruction: string) {
  const brand = await getBrandProfile(organizationId);
  return generateCaption({
    businessName: brand?.businessName ?? "this business",
    category: brand?.category ?? undefined,
    description: brand?.description ?? undefined,
    productsServices: asStringArray(brand?.productsServices) ?? undefined,
    tone: brand?.tone ?? undefined,
    language: brand?.language ? LANGUAGE_NAMES[brand.language] : undefined,
    brief: instruction,
  });
}

function parseTimezone(value: FormDataEntryValue | null): string {
  const parsed = createTimezoneSchema((key) => key).safeParse(value);
  return parsed.success ? parsed.data : "UTC";
}

export interface EditContentJobResult {
  ok: boolean;
  /** Shown to the user after a successful save when something about the
   * edit didn't fully apply - e.g. Instagram not supporting caption edits
   * after publishing, or the live Facebook update failing. */
  note?: string;
  /** Set when a reschedule was rejected because another job already
   * occupies that exact scheduled time. */
  error?: "time_taken";
}

/** A job that's already publishing/published/cancelled can't be
 * rescheduled - only its (shared) caption is still meaningfully editable,
 * and even then only Facebook's API supports pushing that change to the
 * already-live post. */
function isLocked(status: string): boolean {
  return status === "PUBLISHING" || status === "PUBLISHED" || status === "CANCELLED";
}

export async function editContentJobAction(
  formData: FormData,
): Promise<EditContentJobResult> {
  const session = await getSession();
  if (!session) return { ok: false };

  const jobId = formData.get("jobId");
  if (typeof jobId !== "string") return { ok: false };

  const existing = await getContentJob(session.organizationId, jobId);
  if (!existing) return { ok: false };

  const tCalendar = await getTranslations("dashboard.calendar");

  if (isLocked(existing.status)) {
    const parsed = createEditPublishedPostSchema((key) => key).safeParse({
      instruction: formData.get("instruction"),
    });
    if (!parsed.success) return { ok: false };

    let caption: string;
    let hashtags: string[];
    try {
      ({ caption, hashtags } = await generateCaptionFromInstruction(
        session.organizationId,
        parsed.data.instruction,
      ));
    } catch (error) {
      console.error("Generating the caption from the instruction failed", error);
      return { ok: false };
    }

    const updated = await rescheduleContentJob(session.organizationId, jobId, {
      caption,
      hashtags,
      captionInstruction: parsed.data.instruction,
    });
    if ("error" in updated) return { ok: false };

    let note: string | undefined;
    const facebookPublication = existing.publications.find(
      (p) => p.platform === "FACEBOOK" && p.status === "PUBLISHED" && p.externalPostId,
    );
    const instagramPublished = existing.publications.some(
      (p) => p.platform === "INSTAGRAM" && p.status === "PUBLISHED",
    );

    if (facebookPublication) {
      const accounts = await listSocialAccounts(session.organizationId);
      const facebookAccount = accounts.find((account) => account.provider === "FACEBOOK");
      if (facebookAccount) {
        try {
          await updateFacebookPostCaption(
            decryptToken(facebookAccount.accessToken),
            facebookPublication.externalPostId!,
            caption,
          );
        } catch (error) {
          console.error("Updating the live Facebook post caption failed", error);
          note = tCalendar("facebookUpdateFailed");
        }
      } else {
        note = tCalendar("facebookAccountMissing");
      }
    } else if (instagramPublished) {
      note = tCalendar("instagramCaptionLocked");
    }

    revalidatePath("/dashboard/calendar");
    return { ok: true, note };
  }

  const parsed = createEditContentPostSchema((key) => key).safeParse({
    instruction: formData.get("instruction"),
    date: formData.get("date"),
    time: formData.get("time"),
  });
  if (!parsed.success) return { ok: false };

  let caption: string;
  let hashtags: string[];
  try {
    ({ caption, hashtags } = await generateCaptionFromInstruction(
      session.organizationId,
      parsed.data.instruction,
    ));
  } catch (error) {
    console.error("Generating the caption from the instruction failed", error);
    return { ok: false };
  }

  const timezone = parseTimezone(formData.get("timezone"));
  await ensurePublishingScheduleTimezone(session.organizationId, timezone);

  const [year, month, day] = parsed.data.date.split("-").map(Number);
  const [hour, minute] = parsed.data.time.split(":").map(Number);
  const scheduledFor = zonedTimeToUtc({ year, month, day, hour, minute }, timezone);

  const result = await rescheduleContentJob(session.organizationId, jobId, {
    caption,
    hashtags,
    captionInstruction: parsed.data.instruction,
    scheduledFor,
  });
  if ("error" in result) {
    return result.error === "time_taken" ? { ok: false, error: "time_taken" } : { ok: false };
  }

  revalidatePath("/dashboard/calendar");
  return { ok: true };
}

/** Drops one platform from a job - just that platform's card, or the whole
 * job if it was the last platform on it. Doesn't touch anything already
 * live on the platform, only our own scheduling/publication record. */
export async function deleteContentJobPlatformAction(formData: FormData) {
  const session = await getSession();
  if (!session) return;

  const jobId = formData.get("jobId");
  const platform = formData.get("platform");
  if (typeof jobId !== "string") return;
  if (platform !== "INSTAGRAM" && platform !== "FACEBOOK") return;

  await removeContentJobPlatform(session.organizationId, jobId, platform as Platform);
  revalidatePath("/dashboard/calendar");
}
