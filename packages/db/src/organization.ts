import type { OrganizationStatus } from "@prisma/client";
import { prisma } from "./index";

/** Lightweight check for the worker's per-job eligibility gate - avoids
 * pulling the whole Organization row just to read one field. Every org on
 * this brand stays ACTIVE forever (no admin panel here to change it), but
 * this is declared so the worker - shared with YOPAPI, which does have an
 * admin panel - correctly skips generation/publishing for either brand's
 * non-ACTIVE orgs. */
export async function getOrganizationStatus(
  organizationId: string,
): Promise<OrganizationStatus | null> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { status: true },
  });
  return organization?.status ?? null;
}
