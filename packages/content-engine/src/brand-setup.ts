import type { BrandCreativeProfile, BrandProfile } from "@socialpilot/db";

/**
 * A business's one-time setup is "done" once it has a logo and one
 * approved visual style - that's everything the AI pipeline needs to
 * generate on-brand content on its own from then on. Pure and DB-free so
 * every page that already fetches these two records (Overview, Schedule)
 * can reuse the same definition without an extra query.
 */
export function isBrandSetupComplete(
  brand: Pick<BrandProfile, "logoUrl"> | null,
  creativeProfile: BrandCreativeProfile | null,
): boolean {
  return Boolean(brand?.logoUrl) && Boolean(creativeProfile);
}
