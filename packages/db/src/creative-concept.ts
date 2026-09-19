import type { ConceptKind } from "@prisma/client";
import { prisma } from "./index";

// A never-approved concept past this age gets its image deleted and the
// row removed by apps/worker's concept-cleanup cycle - an approved one is
// never touched regardless of age (see createCreativeConcept/expiresAt).
const CONCEPT_EXPIRY_MS = 10 * 60 * 60 * 1000;

export interface CreateCreativeConceptInput {
  organizationId: string;
  brief: string;
  imageUrls: string[];
  kind?: ConceptKind;
}

export function createCreativeConcept(input: CreateCreativeConceptInput) {
  return prisma.creativeConcept.create({
    data: {
      ...input,
      expiresAt: new Date(Date.now() + CONCEPT_EXPIRY_MS),
    },
  });
}

export function getCreativeConcept(organizationId: string, id: string) {
  return prisma.creativeConcept.findFirst({ where: { id, organizationId } });
}

/** Marks a LOGO concept APPROVED, same protection approveCreativeConcept
 * gives a BRAND_STYLE concept - without this, a logo a customer actively
 * chose and is using stayed PENDING forever, so concept-cleanup deleted
 * its R2 image once the 10-hour expiry passed regardless of it still
 * being the live BrandProfile.logoUrl. */
export function approveLogoConcept(organizationId: string, id: string) {
  return prisma.creativeConcept.updateMany({
    where: { id, organizationId },
    data: { status: "APPROVED" },
  });
}

/** The organization's latest not-yet-expired, not-yet-approved concept of
 * a given kind - for surfacing "your most recent generation" on a settings
 * page even after the user navigated away from the review page without
 * approving or rejecting it. Returns null once it's been approved (no
 * longer a "candidate") or has expired (already cleaned up). */
export function getMostRecentPendingConcept(organizationId: string, kind: ConceptKind) {
  return prisma.creativeConcept.findFirst({
    where: { organizationId, kind, status: "PENDING", expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
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
