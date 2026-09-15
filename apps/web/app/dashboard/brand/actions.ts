"use server";

import { getPublishingSchedule, hasGeneratedContentToday, upsertBrandProfile } from "@socialpilot/db";
import { analyzeBrandDescription, uploadLogo } from "@socialpilot/content-engine";
import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import {
  createBrandProfileSchema,
  LOGO_ALLOWED_TYPES,
  LOGO_MAX_BYTES,
} from "@/lib/validation";

export interface BrandSettingsFormState {
  error?: string;
  success?: boolean;
  /** Set when today's content image already generated - this edit is
   * still saved, but (per the deliberate one-image-per-day rule - see
   * findMasterImageForDay) won't affect anything until tomorrow. */
  note?: string;
}

function stringValues(formData: FormData, key: string): string[] {
  return formData
    .getAll(key)
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

export async function updateBrandProfileAction(
  _prevState: BrandSettingsFormState,
  formData: FormData,
): Promise<BrandSettingsFormState> {
  const tErrors = await getTranslations("common.errors");
  const session = await getSession();
  if (!session) {
    return { error: tErrors("sessionExpired") };
  }

  const tValidation = await getTranslations("validation");
  const parsed = createBrandProfileSchema(tValidation).safeParse({
    businessName: formData.get("businessName"),
    category: formData.get("category"),
    description: formData.get("description"),
    colors: stringValues(formData, "colors"),
    language: formData.get("language"),
    tone: formData.get("tone"),
    productsServices: stringValues(formData, "productsServices"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? tErrors("invalidInput") };
  }

  let logoUrl: string | undefined;
  const logoFile = formData.get("logo");
  if (logoFile instanceof File && logoFile.size > 0) {
    if (logoFile.size > LOGO_MAX_BYTES) {
      return { error: tErrors("logoTooLarge") };
    }
    if (!LOGO_ALLOWED_TYPES.includes(logoFile.type)) {
      return { error: tErrors("logoInvalidType") };
    }
    try {
      logoUrl = await uploadLogo(session.organizationId, logoFile);
    } catch (error) {
      console.error("Logo upload failed", error);
      return { error: tErrors("logoUploadFailed") };
    }
  }

  let category = parsed.data.category || undefined;
  let tone = parsed.data.tone || undefined;
  let productsServices = parsed.data.productsServices;

  // The description is meant to work on its own - a business owner who
  // just describes their business in plain words shouldn't also have to
  // fill in category/tone/products by hand. Only fills gaps: anything the
  // user already typed into those fields directly is left alone.
  const description = parsed.data.description;
  if (description && (!category || !tone || productsServices.length === 0)) {
    try {
      const analyzed = await analyzeBrandDescription(description);
      category ??= analyzed.category ?? undefined;
      tone ??= analyzed.tone ?? undefined;
      if (productsServices.length === 0 && analyzed.productsServices.length > 0) {
        productsServices = analyzed.productsServices;
      }
    } catch (error) {
      console.error("Brand description analysis failed", error);
    }
  }

  await upsertBrandProfile({
    organizationId: session.organizationId,
    businessName: parsed.data.businessName,
    category,
    description: parsed.data.description || undefined,
    colors: parsed.data.colors,
    language: parsed.data.language,
    tone,
    productsServices,
    ...(logoUrl ? { logoUrl } : {}),
  });

  revalidatePath("/dashboard/brand");

  const schedule = await getPublishingSchedule(session.organizationId);
  const alreadyGeneratedToday = await hasGeneratedContentToday(
    session.organizationId,
    schedule.timezone,
  );
  if (alreadyGeneratedToday) {
    const tBrand = await getTranslations("dashboard.brand");
    return {
      success: true,
      note: tBrand("savedTakesEffectTomorrow"),
    };
  }

  return { success: true };
}
