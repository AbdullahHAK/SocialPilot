import { prisma } from "./index";

export interface UpsertBrandProfileInput {
  organizationId: string;
  businessName: string;
  category?: string;
  description?: string;
  logoUrl?: string;
  colors?: string[];
  language: string;
  tone?: string;
  productsServices?: string[];
}

export async function upsertBrandProfile(input: UpsertBrandProfileInput) {
  const { organizationId, ...data } = input;

  return prisma.brandProfile.upsert({
    where: { organizationId },
    create: { organizationId, ...data },
    update: data,
  });
}

export function getBrandProfile(organizationId: string) {
  return prisma.brandProfile.findUnique({ where: { organizationId } });
}

/** Sets the approved logo on its own, without needing every other brand
 * field on hand - used after an AI-generated logo concept is approved. */
export function setBrandLogo(organizationId: string, logoUrl: string) {
  return prisma.brandProfile.update({
    where: { organizationId },
    data: { logoUrl },
  });
}
