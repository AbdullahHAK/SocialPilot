"use server";

import {
  createCreativeConcept,
  getBrandProfile,
  getMonthlyImageUsage,
  MONTHLY_LOGO_CAP,
  MONTHLY_TOTAL_IMAGE_CAP,
  setBrandColors,
  setBrandLogo,
} from "@socialpilot/db";
import { buildLogoPrompt, generateImage, uploadGeneratedImage, uploadLogo } from "@socialpilot/content-engine";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { createColorsSchema, LOGO_ALLOWED_TYPES, LOGO_MAX_BYTES } from "@/lib/validation";
import { safeReturnTo } from "@/lib/safe-return-to";
import { getSession } from "@/lib/session";

export interface GenerateLogoFormState {
  error?: string;
}

// The client's explicit cost-control request: one image per generation
// request, not several to choose from - same treatment as Brand Style,
// since this flow had the identical unlimited-regeneration loophole.
const LOGO_CONCEPT_COUNT = 1;

export async function generateLogoConceptsAction(
  _prevState: GenerateLogoFormState,
  formData: FormData,
): Promise<GenerateLogoFormState> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const t = await getTranslations("dashboard.logo.errors");
  const prompt = formData.get("prompt")?.toString().trim();
  if (!prompt) {
    return { error: t("describeLogo") };
  }
  if (prompt.length > 500) {
    return { error: t("descriptionTooLong") };
  }

  const usage = await getMonthlyImageUsage(session.organizationId);
  if (usage.total >= MONTHLY_TOTAL_IMAGE_CAP) {
    return { error: t("totalCapReached", { cap: MONTHLY_TOTAL_IMAGE_CAP }) };
  }
  if (usage.logo >= MONTHLY_LOGO_CAP) {
    return { error: t("logoCapReached", { cap: MONTHLY_LOGO_CAP }) };
  }

  const returnTo = safeReturnTo(formData.get("returnTo"), "/dashboard/brand");

  const brand = await getBrandProfile(session.organizationId);
  const fullPrompt = buildLogoPrompt(prompt, brand?.businessName);

  let imageUrls: string[];
  try {
    const buffers = await Promise.all(
      Array.from({ length: LOGO_CONCEPT_COUNT }, () =>
        generateImage({ prompt: fullPrompt, quality: "medium" }),
      ),
    );
    imageUrls = await Promise.all(
      buffers.map((buffer) => uploadGeneratedImage(session.organizationId, buffer)),
    );
  } catch (error) {
    console.error("Logo concept generation failed", error);
    return { error: t("generationFailed") };
  }

  const concept = await createCreativeConcept({
    organizationId: session.organizationId,
    brief: `[logo] ${prompt}`,
    imageUrls,
    kind: "LOGO",
  });

  redirect(
    `/dashboard/logo/${concept.id}?returnTo=${encodeURIComponent(returnTo)}`,
  );
}

export async function approveLogoAction(formData: FormData) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const imageUrl = formData.get("imageUrl")?.toString();
  if (!imageUrl) return;

  await setBrandLogo(session.organizationId, imageUrl);

  const returnTo = safeReturnTo(formData.get("returnTo"), "/dashboard/brand");
  const separator = returnTo.includes("?") ? "&" : "?";
  redirect(`${returnTo}${separator}logoApproved=1`);
}

/** The alternative to AI generation on the same page - a business that
 * already has a logo file shouldn't have to describe it to an image model
 * just to get it set. Mirrors approveLogoAction's redirect-with-a-flag
 * pattern so the destination page shows the same "logo saved" banner
 * either way. */
export async function uploadLogoAction(
  _prevState: GenerateLogoFormState,
  formData: FormData,
): Promise<GenerateLogoFormState> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const tErrors = await getTranslations("common.errors");
  const logoFile = formData.get("logo");
  if (!(logoFile instanceof File) || logoFile.size === 0) {
    return { error: tErrors("logoRequired") };
  }
  if (logoFile.size > LOGO_MAX_BYTES) {
    return { error: tErrors("logoTooLarge") };
  }
  if (!LOGO_ALLOWED_TYPES.includes(logoFile.type)) {
    return { error: tErrors("logoInvalidType") };
  }

  let logoUrl: string;
  try {
    logoUrl = await uploadLogo(session.organizationId, logoFile);
  } catch (error) {
    console.error("Logo upload failed", error);
    return { error: tErrors("logoUploadFailed") };
  }

  await setBrandLogo(session.organizationId, logoUrl);

  const returnTo = safeReturnTo(formData.get("returnTo"), "/dashboard/brand");
  const separator = returnTo.includes("?") ? "&" : "?";
  redirect(`${returnTo}${separator}logoApproved=1`);
}

export interface SaveColorsFormState {
  error?: string;
  success?: boolean;
}

/** Independent of the logo entirely - a business can set/update its brand
 * colors here without generating or uploading anything, and content
 * generation already favors these colors where natural (see
 * packages/content-engine/src/brand-prompt.ts). */
export async function saveBrandColorsAction(
  _prevState: SaveColorsFormState,
  formData: FormData,
): Promise<SaveColorsFormState> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const tValidation = await getTranslations("validation");
  const colors = formData
    .getAll("colors")
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  const parsed = createColorsSchema(tValidation).safeParse({ colors });
  if (!parsed.success) {
    const tErrors = await getTranslations("common.errors");
    return { error: parsed.error.issues[0]?.message ?? tErrors("invalidInput") };
  }

  await setBrandColors(session.organizationId, parsed.data.colors);
  return { success: true };
}
