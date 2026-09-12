"use server";

import {
  createCreativeConcept,
  getBrandProfile,
  setBrandLogo,
} from "@socialpilot/db";
import { redirect } from "next/navigation";
import { buildLogoPrompt } from "@/lib/brand-prompt";
import { generateImage } from "@/lib/openai";
import { getSession } from "@/lib/session";
import { uploadGeneratedImage } from "@/lib/storage";

export interface GenerateLogoFormState {
  error?: string;
}

const LOGO_CONCEPT_COUNT = 3;

export async function generateLogoConceptsAction(
  _prevState: GenerateLogoFormState,
  formData: FormData,
): Promise<GenerateLogoFormState> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const prompt = formData.get("prompt")?.toString().trim();
  if (!prompt) {
    return { error: "Describe the logo you want." };
  }
  if (prompt.length > 500) {
    return { error: "Keep the description under 500 characters." };
  }

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
    return { error: "Couldn't generate logo concepts right now. Please try again." };
  }

  const concept = await createCreativeConcept({
    organizationId: session.organizationId,
    brief: `[logo] ${prompt}`,
    imageUrls,
  });

  redirect(`/dashboard/logo/${concept.id}`);
}

export async function approveLogoAction(formData: FormData) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const imageUrl = formData.get("imageUrl")?.toString();
  if (!imageUrl) return;

  await setBrandLogo(session.organizationId, imageUrl);

  redirect("/dashboard/brand?logoApproved=1");
}
