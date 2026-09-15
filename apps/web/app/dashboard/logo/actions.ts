"use server";

import {
  createCreativeConcept,
  getBrandProfile,
  getMonthlyImageUsage,
  MONTHLY_LOGO_CAP,
  MONTHLY_TOTAL_IMAGE_CAP,
  setBrandLogo,
} from "@socialpilot/db";
import { buildLogoPrompt, generateImage, uploadGeneratedImage } from "@socialpilot/content-engine";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
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
