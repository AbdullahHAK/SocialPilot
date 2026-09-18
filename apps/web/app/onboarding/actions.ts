"use server";

import { upsertBrandProfile } from "@socialpilot/db";
import { analyzeBrandDescription } from "@socialpilot/content-engine";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { createBrandProfileSchema } from "@/lib/validation";

export interface OnboardingFormState {
  error?: string;
}

function stringValues(formData: FormData, key: string): string[] {
  return formData
    .getAll(key)
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

export async function saveBrandProfileAction(
  _prevState: OnboardingFormState,
  formData: FormData,
): Promise<OnboardingFormState> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const [tValidation, tErrors] = await Promise.all([
    getTranslations("validation"),
    getTranslations("common.errors"),
  ]);
  const parsed = createBrandProfileSchema(tValidation).safeParse({
    businessName: formData.get("businessName"),
    category: formData.get("category"),
    description: formData.get("description"),
    language: formData.get("language"),
    tone: formData.get("tone"),
    productsServices: stringValues(formData, "productsServices"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? tErrors("invalidInput") };
  }

  let category = parsed.data.category || undefined;
  let tone = parsed.data.tone || undefined;
  let productsServices = parsed.data.productsServices;

  // Same free-text-first behavior as editing this later in Brand Settings -
  // a business owner who describes their business in plain words during
  // onboarding shouldn't also have to fill in category/tone/products.
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
    language: parsed.data.language,
    tone,
    productsServices,
  });

  // Straight into the one-time brand setup (logo, then an approved visual
  // style) rather than a dashboard that would otherwise sit there looking
  // ready without anything to actually generate content from yet.
  redirect("/dashboard/create");
}
