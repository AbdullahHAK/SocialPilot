import { Prisma, type OrgBrand, type OrganizationStatus } from "@prisma/client";
import { prisma } from "./index";
import { hashPassword, verifyPassword } from "./password";

export class EmailAlreadyInUseError extends Error {
  constructor() {
    super("Email is already in use");
    this.name = "EmailAlreadyInUseError";
  }
}

/** Which brand a new signup belongs to - PRODUCT_BRAND is only set to
 * "YOPAPI" in that Vercel project's env vars; unset (main/SocialPilot)
 * falls back to SOCIALPILOT. Guards against a garbage env value ever
 * reaching Prisma. */
function resolveBrand(): OrgBrand {
  return process.env.PRODUCT_BRAND === "YOPAPI" ? "YOPAPI" : "SOCIALPILOT";
}

export interface SignUpInput {
  email: string;
  password: string;
  organizationName: string;
  name?: string;
}

export interface SignUpResult {
  userId: string;
  organizationId: string;
}

/**
 * Creates a User, its Organization (tenant), and the OWNER Membership
 * linking them in a single Prisma nested write (atomic).
 */
export async function signUp(input: SignUpInput): Promise<SignUpResult> {
  const passwordHash = await hashPassword(input.password);

  try {
    const user = await prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash,
        memberships: {
          create: {
            role: "OWNER",
            organization: {
              create: {
                name: input.organizationName,
                brand: resolveBrand(),
                publishingSchedule: { create: {} },
              },
            },
          },
        },
      },
      include: { memberships: true },
    });

    const membership = user.memberships[0];
    if (!membership) {
      throw new Error("Expected membership to be created alongside user");
    }

    return { userId: user.id, organizationId: membership.organizationId };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new EmailAlreadyInUseError();
    }
    throw error;
  }
}

/** A second (or third...) business under the same login - e.g. one person
 * running two different restaurants, each with its own Page/Instagram and
 * its own subscription. Mirrors signUp's org-creation shape but attaches
 * to an existing user instead of creating one. */
export async function createOrganizationForUser(userId: string, organizationName: string) {
  return prisma.organization.create({
    data: {
      name: organizationName,
      brand: resolveBrand(),
      publishingSchedule: { create: {} },
      memberships: { create: { userId, role: "OWNER" } },
    },
  });
}

/** Every organization this login can switch into, for the dashboard's
 * account switcher. */
export function listOrganizationsForUser(userId: string) {
  return prisma.organization.findMany({
    where: { memberships: { some: { userId } } },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
}

/** Guards switchOrganizationAction - a user can only switch into an org
 * they actually belong to. */
export function isOrganizationMember(userId: string, organizationId: string) {
  return prisma.membership
    .findUnique({ where: { userId_organizationId: { userId, organizationId } } })
    .then(Boolean);
}

export interface AuthenticateResult {
  userId: string;
  organizationId: string;
  organizationStatus: OrganizationStatus;
  sessionVersion: number;
}

/** Admin's "reset access" action - no email-sending infrastructure exists
 * in this app, so a temp password an admin hands off directly is the
 * practical equivalent of a reset-link flow. */
export async function setUserPassword(userId: string, newPassword: string) {
  const passwordHash = await hashPassword(newPassword);
  return prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}

export async function authenticate(
  email: string,
  password: string,
): Promise<AuthenticateResult | null> {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { memberships: { include: { organization: true } } },
  });
  if (!user) return null;

  const passwordMatches = await verifyPassword(password, user.passwordHash);
  if (!passwordMatches) return null;

  const membership = user.memberships[0];
  if (!membership) return null;

  return {
    userId: user.id,
    organizationId: membership.organizationId,
    organizationStatus: membership.organization.status,
    sessionVersion: user.sessionVersion,
  };
}
