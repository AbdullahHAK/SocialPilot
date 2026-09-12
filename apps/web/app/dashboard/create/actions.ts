"use server";

import {
  approveCreativeConcept,
  createCreativeConcept,
  getBrandProfile,
} from "@socialpilot/db";
import { redirect } from "next/navigation";
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

function buildFullPrompt(
  prompt: string,
  brand: { businessName: string; category: string | null; tone: string | null } | null,
): string {
  const parts = [prompt];
  if (brand) {
    parts.push(
      `Business: ${brand.businessName}${brand.category ? ` (${brand.category})` : ""}.`,
    );
    if (brand.tone) parts.push(`Tone: ${brand.tone}.`);
  }
  parts.push(
    "Square, social-media-ready composition, professional photography quality.",
  );
  return parts.join(" ");
}

export async function generateConceptsAction(
  _prevState: CreateContentFormState,
  formData: FormData,
): Promise<CreateContentFormState> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
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

  const referenceImages = await Promise.all(
    files.map(async (file) => Buffer.from(await file.arrayBuffer())),
  );

  const brand = await getBrandProfile(session.organizationId);
  const fullPrompt = buildFullPrompt(prompt, brand);

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
