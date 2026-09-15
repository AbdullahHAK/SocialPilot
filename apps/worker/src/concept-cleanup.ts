import { prisma } from "@socialpilot/db";
import { deleteGeneratedImage } from "@socialpilot/content-engine";

/**
 * Deletes the R2 image(s) and database row for every Brand Style/logo
 * concept that was never approved and has passed its 10-hour expiry
 * (CreativeConcept.expiresAt) - keeps storage bounded to images someone
 * actually kept, instead of accumulating every abandoned generation
 * attempt forever. Only ever considers `status: "PENDING"` rows - an
 * `APPROVED` concept's `expiresAt` is simply never acted on here,
 * regardless of how old it is, which is what guarantees a business's
 * current Brand Style/logo can never be swept up by this cycle.
 */
export async function runConceptCleanupCycle(now: Date = new Date()): Promise<void> {
  const expired = await prisma.creativeConcept.findMany({
    where: { status: "PENDING", expiresAt: { lte: now } },
  });

  for (const concept of expired) {
    try {
      // Conditional delete (still PENDING right now, not just when listed
      // above) before touching storage - guards against a narrow race
      // where the user approves the concept between the query above and
      // this delete. If someone else already changed its status (deleted
      // count 0), skip straight past it and never touch its images -
      // approving copies the chosen URL into BrandCreativeProfile, so an
      // approval that won this race must keep its image intact.
      const result = await prisma.creativeConcept.deleteMany({
        where: { id: concept.id, status: "PENDING" },
      });
      if (result.count === 0) continue;

      await Promise.all(concept.imageUrls.map((url) => deleteGeneratedImage(url)));
    } catch (error) {
      console.error(`Cleaning up expired concept ${concept.id} failed`, error);
    }
  }
}
