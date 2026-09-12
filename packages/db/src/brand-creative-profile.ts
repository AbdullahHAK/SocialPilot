import { prisma } from "./index";

export function getBrandCreativeProfile(organizationId: string) {
  return prisma.brandCreativeProfile.findUnique({ where: { organizationId } });
}
