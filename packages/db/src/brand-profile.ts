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
 * field on hand - used after an AI-generated logo concept is approved.
 * Upserts rather than updates: a user can reach this point (e.g. via the
 * Create Content logo gate) without ever having completed onboarding, in
 * which case no BrandProfile row exists yet. Falls back to the
 * organization's name for the required businessName field in that case. */
export async function setBrandLogo(organizationId: string, logoUrl: string) {
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { name: true },
  });

  return prisma.brandProfile.upsert({
    where: { organizationId },
    update: { logoUrl },
    create: { organizationId, logoUrl, businessName: organization.name },
  });
}
