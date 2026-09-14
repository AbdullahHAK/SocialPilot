import type { BrandStyleProfile } from "./openai";

export interface BrandContext {
  businessName: string;
  category?: string | null;
  tone?: string | null;
  description?: string | null;
  colors?: string[] | null;
}

// Client's explicit product philosophy: the AI should build brand
// recognition and keep the business memorable, not just push prices - a
// price/discount changes weekly and stops mattering, but "this place makes
// great food" doesn't. Only break this when the user's own prompt asks for
// a specific price or promotion.
const BRAND_BUILDING_GUIDANCE =
  "Prioritize brand recognition, product quality, and an appetizing, memorable presentation over price promotion. Do not add specific prices, discount percentages, or \"sale\"/\"% off\" banners to the image unless the request above explicitly asks for a price or promotion - prefer broader messages like a special offer, a limited-time promotion, or simply showcasing the product beautifully.";

// The client's explicit complaint: two auto-generated posts came out
// looking almost identical. Reference images are there to anchor overall
// brand style (color grading, mood, logo placement), not to be redrawn
// verbatim each time - without saying so explicitly, the model tends to
// stay very close to whatever reference it's given.
const VARIETY_GUIDANCE =
  "Treat any reference images only as a guide to the brand's overall visual style, color palette, and mood - do not recreate their exact composition, camera angle, framing, or subject arrangement. Invent a fresh, distinct composition for this image.";

const QUALITY_GUIDANCE =
  "Photorealistic professional photography, natural realistic lighting and textures, sharp focus, no distorted or extra objects, no warped text or watermark artifacts, no plastic or uncanny surfaces - it should not look AI-generated.";

export function buildImagePrompt(
  userPrompt: string,
  brand: BrandContext | null,
  extra?: string,
): string {
  const parts = [userPrompt];
  if (brand) {
    parts.push(
      `Business: ${brand.businessName}${brand.category ? ` (${brand.category})` : ""}.`,
    );
    if (brand.description) {
      parts.push(`About the business: ${brand.description}`);
    }
    if (brand.tone) parts.push(`Tone: ${brand.tone}.`);
    if (brand.colors && brand.colors.length > 0) {
      parts.push(`Favor these brand colors where natural: ${brand.colors.join(", ")}.`);
    }
  }
  if (extra) parts.push(extra);
  parts.push(BRAND_BUILDING_GUIDANCE);
  parts.push(VARIETY_GUIDANCE);
  parts.push(QUALITY_GUIDANCE);
  parts.push(
    "Square, social-media-ready composition, professional photography quality.",
  );
  return parts.join(" ");
}

export interface CreativeVariation {
  contentTheme: string;
  subject: string;
  cameraAngle: string;
  cameraDistance: string;
  composition: string;
  environment: string;
  lighting: string;
}

function styleProfileText(profile: BrandStyleProfile): string {
  const parts: string[] = [];
  if (profile.colors.length > 0) parts.push(`Brand colors: ${profile.colors.join(", ")}.`);
  if (profile.photographyStyle) parts.push(`Photography style: ${profile.photographyStyle}`);
  if (profile.lightingStyle) parts.push(`Lighting style: ${profile.lightingStyle}`);
  if (profile.visualQuality) parts.push(`Visual quality: ${profile.visualQuality}`);
  if (profile.brandPersonality) parts.push(`Brand personality: ${profile.brandPersonality}`);
  if (profile.designAesthetic) parts.push(`Design aesthetic: ${profile.designAesthetic}`);
  if (profile.logoUsage) parts.push(`Logo usage: ${profile.logoUsage}`);
  return parts.join(" ");
}

function describeMetadata(metadata: Record<string, unknown>): string {
  const fields = ["subject", "cameraAngle", "cameraDistance", "composition", "environment", "lighting"];
  return fields
    .map((f) => metadata[f])
    .filter((v): v is string => typeof v === "string" && v.length > 0)
    .join(", ");
}

/**
 * Builds the prompt for the recurring daily-content pipeline - distinct
 * from buildImagePrompt (used for the initial concept proposals and their
 * feedback-driven regeneration, where staying close to prior images is the
 * point). This is the client's explicit fix for posts looking repetitive:
 * the approved concept is described in words (styleProfile) rather than
 * handed to the model as an image to redraw, and each call is assigned a
 * different combination of subject/angle/distance/composition/environment/
 * lighting, with recent posts' actual choices spelled out as what NOT to
 * repeat.
 */
export function buildContentPrompt(
  brief: string,
  brand: BrandContext,
  styleProfile: BrandStyleProfile | null,
  variation: CreativeVariation,
  recentMetadata: object[],
): string {
  const parts = [brief];
  parts.push(
    `Business: ${brand.businessName}${brand.category ? ` (${brand.category})` : ""}.`,
  );
  if (brand.description) parts.push(`About the business: ${brand.description}`);
  if (brand.tone) parts.push(`Tone: ${brand.tone}.`);
  if (brand.colors && brand.colors.length > 0 && !styleProfile) {
    parts.push(`Favor these brand colors where natural: ${brand.colors.join(", ")}.`);
  }

  if (styleProfile) {
    parts.push(
      "Preserve the approved brand's visual identity, described below - but this must be a completely new visual concept, not another image similar to any previously approved or generated one.",
    );
    parts.push(styleProfileText(styleProfile));
  }

  parts.push(
    `This specific post: ${variation.contentTheme} Subject: ${variation.subject} Camera angle: ${variation.cameraAngle} Camera distance: ${variation.cameraDistance} Composition: ${variation.composition} Environment: ${variation.environment} Lighting: ${variation.lighting}`,
  );

  const avoidList = recentMetadata
    .map((m) => describeMetadata(m as Record<string, unknown>))
    .filter((s) => s.length > 0);
  if (avoidList.length > 0) {
    parts.push(
      `Do not repeat these exact combinations used in recent posts: ${avoidList.join(" | ")}.`,
    );
  }

  parts.push(BRAND_BUILDING_GUIDANCE);
  parts.push(QUALITY_GUIDANCE);
  parts.push("Square, social-media-ready composition, professional photography quality.");
  return parts.join(" ");
}

export function buildLogoPrompt(userPrompt: string, businessName?: string): string {
  const parts = [userPrompt];
  if (businessName) parts.push(`Business name: ${businessName}.`);
  parts.push(
    "Professional logo design, clean modern iconography and typography, centered composition, simple flat vector style, plain white background, no photographic elements, no mockup or product shot - just the standalone logo.",
  );
  return parts.join(" ");
}
