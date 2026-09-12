"use server";

import { upsertBrandProfile } from "@socialpilot/db";
import { revalidatePath } from "next/cache";
import { analyzeBrandDescription } from "@/lib/openai";
import { getSession } from "@/lib/session";
import { uploadLogo } from "@/lib/storage";
import {
  brandProfileSchema,
  LOGO_ALLOWED_TYPES,
  LOGO_MAX_BYTES,
} from "@/lib/validation";

export interface BrandSettingsFormState {
  error?: string;
  success?: boolean;
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
  const session = await getSession();
  if (!session) {
    return { error: "Your session expired. Please log in again." };
  }

  const parsed = brandProfileSchema.safeParse({
    businessName: formData.get("businessName"),
    category: formData.get("category"),
    description: formData.get("description"),
    colors: stringValues(formData, "colors"),
    language: formData.get("language"),
    tone: formData.get("tone"),
    productsServices: stringValues(formData, "productsServices"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  let logoUrl: string | undefined;
  const logoFile = formData.get("logo");
  if (logoFile instanceof File && logoFile.size > 0) {
    if (logoFile.size > LOGO_MAX_BYTES) {
      return { error: "Logo must be 4MB or smaller." };
    }
    if (!LOGO_ALLOWED_TYPES.includes(logoFile.type)) {
      return { error: "Logo must be a PNG, JPEG, WebP, or SVG image." };
    }
    try {
      logoUrl = await uploadLogo(session.organizationId, logoFile);
    } catch (error) {
      console.error("Logo upload failed", error);
      return { error: "Couldn't upload the logo. Please try again." };
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
  return { success: true };
}
