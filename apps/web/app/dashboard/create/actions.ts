"use server";

import {
  approveCreativeConcept,
  createCreativeConcept,
  getBrandProfile,
  getCreativeConcept,
} from "@socialpilot/db";
import { redirect } from "next/navigation";
import { asStringArray } from "@/lib/brand-fields";
import { buildImagePrompt, type BrandContext } from "@/lib/brand-prompt";
import { fetchImageBuffer } from "@/lib/fetch-image";
import { getSession } from "@/lib/session";
import { generateImage } from "@/lib/openai";
import { uploadGeneratedImage } from "@/lib/storage";
import {
  REFERENCE_IMAGE_ALLOWED_TYPES,
  REFERENCE_IMAGE_MAX_BYTES,
  REFERENCE_IMAGE_MAX_COUNT,
} from "@/lib/validation";

export interface CreateContentFormState {
  error?: string;
}

const CONCEPT_COUNT = 3;

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

  const prompt = formData.get("prompt")?.toString().trim();
  if (!prompt) {
    return { error: "Describe what you want to create." };
  }
  if (prompt.length > 1000) {
    return { error: "Keep the description under 1000 characters." };
  }

  const files = formData
    .getAll("referenceImages")
    .filter((value): value is File => value instanceof File && value.size > 0);

  if (files.length > REFERENCE_IMAGE_MAX_COUNT) {
    return { error: `Upload at most ${REFERENCE_IMAGE_MAX_COUNT} images.` };
  }
  for (const file of files) {
    if (file.size > REFERENCE_IMAGE_MAX_BYTES) {
      return { error: "Each image must be 8MB or smaller." };
    }
    if (!REFERENCE_IMAGE_ALLOWED_TYPES.includes(file.type)) {
      return { error: "Images must be PNG, JPEG, or WebP." };
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
    return { error: "Couldn't generate images right now. Please try again." };
  }

  const concept = await createCreativeConcept({
    organizationId: session.organizationId,
    brief: prompt,
    imageUrls,
  });

  redirect(`/dashboard/create/${concept.id}`);
}

export async function approveConceptAction(formData: FormData) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const conceptId = formData.get("conceptId")?.toString();
  const imageUrl = formData.get("imageUrl")?.toString();
  if (!conceptId || !imageUrl) return;

  await approveCreativeConcept(session.organizationId, conceptId, imageUrl);

  redirect("/dashboard/style");
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

  const conceptId = formData.get("conceptId")?.toString();
  const feedback = formData.get("feedback")?.toString().trim();
  if (!conceptId) {
    redirect("/dashboard/create");
  }
  if (!feedback) {
    return { error: "Describe what you'd like to change." };
  }

  const concept = await getCreativeConcept(session.organizationId, conceptId);
  if (!concept) {
    redirect("/dashboard/create");
  }

  const brand = await getBrandProfile(session.organizationId);
  let referenceImages: Buffer[];
  try {
    referenceImages = await Promise.all(
      concept.imageUrls.slice(0, REFERENCE_IMAGE_MAX_COUNT).map(fetchImageBuffer),
    );
  } catch (error) {
    console.error("Fetching prior concept images for regeneration failed", error);
    return { error: "Couldn't load the previous concepts. Please try again." };
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
    return { error: "Couldn't regenerate images right now. Please try again." };
  }

  const newConcept = await createCreativeConcept({
    organizationId: session.organizationId,
    brief: `${concept.brief} — ${feedback}`,
    imageUrls,
  });

  redirect(`/dashboard/create/${newConcept.id}`);
}
