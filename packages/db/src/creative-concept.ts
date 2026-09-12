import { prisma } from "./index";

export interface CreateCreativeConceptInput {
  organizationId: string;
  brief: string;
  imageUrls: string[];
}

export function createCreativeConcept(input: CreateCreativeConceptInput) {
  return prisma.creativeConcept.create({ data: input });
}

export function getCreativeConcept(organizationId: string, id: string) {
  return prisma.creativeConcept.findFirst({ where: { id, organizationId } });
}

export function listCreativeConcepts(organizationId: string) {
  return prisma.creativeConcept.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Approving one of a concept's generated images marks the concept APPROVED
 * and writes the chosen image as the org's brand creative style reference -
 * this is what future content generation is guided by.
 */
export async function approveCreativeConcept(
  organizationId: string,
  id: string,
  chosenImageUrl: string,
) {
  const concept = await prisma.creativeConcept.findFirst({
    where: { id, organizationId },
  });
  if (!concept) return null;

  await prisma.creativeConcept.update({
    where: { id },
    data: { status: "APPROVED" },
  });

  return prisma.brandCreativeProfile.upsert({
    where: { organizationId },
    create: {
      organizationId,
      referenceImageUrls: [chosenImageUrl],
      promptTemplateAdditions: concept.brief,
    },
    update: {
      referenceImageUrls: [chosenImageUrl],
      promptTemplateAdditions: concept.brief,
    },
  });
}
