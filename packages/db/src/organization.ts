import type { OrganizationStatus } from "@prisma/client";
import { prisma } from "./index";

export interface ListOrganizationsInput {
  search?: string;
  limit?: number;
}

/** Rollback for addBusinessAction: an org created for a new business whose
 * activation code turned out invalid shouldn't linger as an empty,
 * unsubscribed entry in the owner's switcher. Cascades Membership etc. */
export function deleteOrganization(organizationId: string) {
  return prisma.organization.delete({ where: { id: organizationId } });
}

/** Admin-facing customer list, always scoped to YOPAPI - SocialPilot and
 * YOPAPI share one database, so this filter is the only thing keeping the
 * two brands' customers from leaking into each other's admin view. */
export function listOrganizations(input: ListOrganizationsInput = {}) {
  const search = input.search?.trim();
  return prisma.organization.findMany({
    where: {
      brand: "YOPAPI",
      ...(search
        ? {
            OR: [
              { id: search },
              { name: { contains: search, mode: "insensitive" } },
              { memberships: { some: { user: { email: { contains: search, mode: "insensitive" } } } } },
            ],
          }
        : {}),
    },
    include: {
      memberships: { include: { user: true }, take: 1 },
      subscription: true,
    },
    orderBy: { createdAt: "desc" },
    take: input.limit ?? 100,
  });
}

/** Full admin profile for one customer - everything the client's spec asks
 * the customer-detail view to show, in one query plus a couple of small
 * count aggregates. */
export async function getOrganizationDetail(organizationId: string) {
  const organization = await prisma.organization.findFirst({
    where: { id: organizationId, brand: "YOPAPI" },
    include: {
      memberships: { include: { user: true } },
      subscription: true,
      socialAccounts: true,
    },
  });
  if (!organization) return null;

  const [publishedCount, failedCount] = await Promise.all([
    prisma.contentPublication.count({
      where: { contentJob: { organizationId }, status: "PUBLISHED" },
    }),
    prisma.contentPublication.count({
      where: { contentJob: { organizationId }, status: "FAILED" },
    }),
  ]);

  return { organization, publishedCount, failedCount };
}

/** Lightweight check for the worker's per-job eligibility gate - avoids
 * pulling the whole Organization row just to read one field. */
export async function getOrganizationStatus(
  organizationId: string,
): Promise<OrganizationStatus | null> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { status: true },
  });
  return organization?.status ?? null;
}

/** Sets an org's status directly - block/unblock/suspend/restore/soft-delete
 * are all just this. Caller is responsible for calling logAdminAction(). */
export function setOrganizationStatus(organizationId: string, status: OrganizationStatus) {
  return prisma.organization.update({
    where: { id: organizationId },
    data: { status },
  });
}

/** Bumps sessionVersion for every user on this org's memberships, which
 * invalidates every outstanding session JWT for them immediately (see
 * apps/web/lib/session.ts) - the practical "force logout from all devices"
 * a stateless JWT session can't otherwise support. */
export async function forceLogoutOrganization(organizationId: string): Promise<number> {
  const memberships = await prisma.membership.findMany({
    where: { organizationId },
    select: { userId: true },
  });
  const result = await prisma.user.updateMany({
    where: { id: { in: memberships.map((m) => m.userId) } },
    data: { sessionVersion: { increment: 1 } },
  });
  return result.count;
}
