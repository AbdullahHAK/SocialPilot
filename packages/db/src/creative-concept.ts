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
 * this is what future content generation is guided by. The image itself is
 * kept (referenceImageUrls) for the logo/quality bar, but the client's
 * explicit fix for repetitive posts is that day-to-day generation should
 * lean on styleDescriptors (a text description of the approved image's
 * transferable style - palette, lighting, personality) rather than
 * treating the image as a composition template - see analyzeBrandStyle.
 */
export async function approveCreativeConcept(
  organizationId: string,
  id: string,
  chosenImageUrl: string,
  styleDescriptors?: object,
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
      styleDescriptors,
    },
    update: {
      referenceImageUrls: [chosenImageUrl],
      promptTemplateAdditions: concept.brief,
      // Only overwrite if we actually have a fresh analysis - a failed
      // analysis (best-effort, see approveConceptAction) shouldn't erase
      // a previously-successful one.
      ...(styleDescriptors ? { styleDescriptors } : {}),
    },
  });
}
