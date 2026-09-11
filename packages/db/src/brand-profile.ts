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
