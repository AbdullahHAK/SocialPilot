"use server";

import {
  approveCreativeConcept,
  createCreativeConcept,
  getBrandProfile,
  getCreativeConcept,
  getMonthlyImageUsage,
  MONTHLY_BRAND_STYLE_CAP,
  MONTHLY_TOTAL_IMAGE_CAP,
} from "@socialpilot/db";
import {
  analyzeBrandStyle,
  asStringArray,
  buildImagePrompt,
  fetchImageBuffer,
  generateImage,
  uploadGeneratedImage,
  type BrandContext,
} from "@socialpilot/content-engine";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { safeReturnTo } from "@/lib/safe-return-to";
import { getSession } from "@/lib/session";
import {
  REFERENCE_IMAGE_ALLOWED_TYPES,
  REFERENCE_IMAGE_MAX_BYTES,
  REFERENCE_IMAGE_MAX_COUNT,
} from "@/lib/validation";

// Once a style is approved, "now go set posting times" is the natural
// next step - the whole point of this pipeline is that content generates
// itself from there on, so there's nothing else to "create" first.
const DEFAULT_RETURN_TO = "/dashboard/schedule";

export interface CreateContentFormState {
  error?: string;
}

// The client's explicit cost-control request: one image per generation
// request, not several to choose from.
const CONCEPT_COUNT = 1;

/** Checked before every Brand Style generation/regeneration - the client's
 * explicit monthly caps (10 Brand Style revisions, contributing to a 40
 * images/month total per org shared with scheduled content and logo
 * generation). Returns a user-facing error string, or null if still
 * allowed. */
async function checkBrandStyleQuota(organizationId: string): Promise<string | null> {
  const usage = await getMonthlyImageUsage(organizationId);
  const t = await getTranslations("dashboard.create.errors");
  if (usage.total >= MONTHLY_TOTAL_IMAGE_CAP) {
    return t("totalCapReached", { cap: MONTHLY_TOTAL_IMAGE_CAP });
  }
  if (usage.brandStyle >= MONTHLY_BRAND_STYLE_CAP) {
    return t("brandStyleCapReached", { cap: MONTHLY_BRAND_STYLE_CAP });
  }
  return null;
}

function toBrandContext(
  brand: Awaited<ReturnType<typeof getBrandProfile>>,
): BrandContext | null {
  if (!brand) return null;
  return {
    businessName: brand.businessName,
    category: brand.category,
    tone: brand.tone,
    description: brand.description,
    colors: asStringArray(brand.colors),
  };
}

export async function generateConceptsAction(
  _prevState: CreateContentFormState,
  formData: FormData,
): Promise<CreateContentFormState> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  // Enforced here too, not just by the page gating which form it shows -
  // a business can't get on-brand content without a logo to be consistent
  // with.
  const brand = await getBrandProfile(session.organizationId);
  if (!brand?.logoUrl) {
    redirect("/dashboard/create");
  }

  const t = await getTranslations("dashboard.create.errors");
  const prompt = formData.get("prompt")?.toString().trim();
  if (!prompt) {
    return { error: t("describeWhatToCreate") };
  }
  if (prompt.length > 1000) {
    return { error: t("descriptionTooLong") };
  }

  const quotaError = await checkBrandStyleQuota(session.organizationId);
  if (quotaError) {
    return { error: quotaError };
  }

  const files = formData
    .getAll("referenceImages")
    .filter((value): value is File => value instanceof File && value.size > 0);

  if (files.length > REFERENCE_IMAGE_MAX_COUNT) {
    return { error: t("tooManyImages", { max: REFERENCE_IMAGE_MAX_COUNT }) };
  }
  for (const file of files) {
    if (file.size > REFERENCE_IMAGE_MAX_BYTES) {
      return { error: t("imageTooLarge") };
    }
    if (!REFERENCE_IMAGE_ALLOWED_TYPES.includes(file.type)) {
      return { error: t("invalidImageType") };
    }
  }

  const referenceImages: Buffer[] = await Promise.all(
    files.map(async (file) => Buffer.from(await file.arrayBuffer())),
  );

  try {
    referenceImages.push(await fetchImageBuffer(brand.logoUrl));
  } catch (error) {
    console.error("Fetching approved logo for reference failed", error);
  }

  const fullPrompt = buildImagePrompt(prompt, toBrandContext(brand));

  let imageUrls: string[];
  try {
    const buffers = await Promise.all(
      Array.from({ length: CONCEPT_COUNT }, () =>
        generateImage({ prompt: fullPrompt, referenceImages }),
      ),
    );
    imageUrls = await Promise.all(
      buffers.map((buffer) => uploadGeneratedImage(session.organizationId, buffer)),
    );
  } catch (error) {
    console.error("Concept generation failed", error);
    return { error: t("generationFailed") };
  }

  const concept = await createCreativeConcept({
    organizationId: session.organizationId,
    brief: prompt,
    imageUrls,
    kind: "BRAND_STYLE",
  });

  const returnTo = safeReturnTo(formData.get("returnTo"), DEFAULT_RETURN_TO);
  redirect(`/dashboard/create/${concept.id}?returnTo=${encodeURIComponent(returnTo)}`);
}

export async function approveConceptAction(formData: FormData) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const conceptId = formData.get("conceptId")?.toString();
  const imageUrl = formData.get("imageUrl")?.toString();
  if (!conceptId || !imageUrl) return;

  // Best-effort: extracts the approved image's transferable visual style
  // (palette, photography/lighting style, personality, aesthetic) so daily
  // content generation can stay on-brand from a text description instead
  // of using this image as a composition template. A failed analysis
  // shouldn't block approval - it just means generation falls back to the
  // business's plain brand fields until the next successful approval.
  let styleDescriptors: object | undefined;
  try {
    const brand = await getBrandProfile(session.organizationId);
    if (brand) {
      styleDescriptors = await analyzeBrandStyle(imageUrl, {
        businessName: brand.businessName,
        category: brand.category,
      });
    }
  } catch (error) {
    console.error("Analyzing the approved concept's brand style failed", error);
  }

  await approveCreativeConcept(session.organizationId, conceptId, imageUrl, styleDescriptors);

  redirect(safeReturnTo(formData.get("returnTo"), DEFAULT_RETURN_TO));
}

export interface RegenerateConceptFormState {
  error?: string;
}

/** The "approve or give feedback and regenerate" loop: reuses the concept's
 * own previously-generated images as references so the new batch keeps the
 * same direction while applying the requested changes, rather than
 * starting over from the plain text brief alone. */
export async function regenerateConceptAction(
  _prevState: RegenerateConceptFormState,
  formData: FormData,
): Promise<RegenerateConceptFormState> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const t = await getTranslations("dashboard.create.errors");
  const conceptId = formData.get("conceptId")?.toString();
  const feedback = formData.get("feedback")?.toString().trim();
  if (!conceptId) {
    redirect("/dashboard/create");
  }
  if (!feedback) {
    return { error: t("describeChange") };
  }

  const concept = await getCreativeConcept(session.organizationId, conceptId);
  if (!concept) {
    redirect("/dashboard/create");
  }

  const quotaError = await checkBrandStyleQuota(session.organizationId);
  if (quotaError) {
    return { error: quotaError };
  }

  const brand = await getBrandProfile(session.organizationId);
  let referenceImages: Buffer[];
  try {
    referenceImages = await Promise.all(
      concept.imageUrls.slice(0, REFERENCE_IMAGE_MAX_COUNT).map(fetchImageBuffer),
    );
  } catch (error) {
    console.error("Fetching prior concept images for regeneration failed", error);
    return { error: t("loadPreviousFailed") };
  }

  const fullPrompt = buildImagePrompt(
    concept.brief,
    toBrandContext(brand),
    `Starting from the style shown in the reference images, apply this requested change: ${feedback}`,
  );

  let imageUrls: string[];
  try {
    const buffers = await Promise.all(
      Array.from({ length: CONCEPT_COUNT }, () =>
        generateImage({ prompt: fullPrompt, referenceImages }),
      ),
    );
    imageUrls = await Promise.all(
      buffers.map((buffer) => uploadGeneratedImage(session.organizationId, buffer)),
    );
  } catch (error) {
    console.error("Concept regeneration failed", error);
    return { error: t("regenerationFailed") };
  }

  const newConcept = await createCreativeConcept({
    organizationId: session.organizationId,
    brief: `${concept.brief} — ${feedback}`,
    imageUrls,
    kind: concept.kind,
  });

  const returnTo = safeReturnTo(formData.get("returnTo"), DEFAULT_RETURN_TO);
  redirect(`/dashboard/create/${newConcept.id}?returnTo=${encodeURIComponent(returnTo)}`);
}
