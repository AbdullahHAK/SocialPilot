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
  parts.push(
    "Square, social-media-ready composition, professional photography quality.",
  );
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
