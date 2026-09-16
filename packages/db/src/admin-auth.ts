import type { AdminRole } from "@prisma/client";
import { prisma } from "./index";
import { hashPassword, verifyPassword } from "./password";

export interface CreateAdminUserInput {
  email: string;
  password: string;
  name?: string;
  role: AdminRole;
}

/** Platform staff, not a customer - see the AdminUser model comment in
 * schema.prisma. There's no self-serve signup for this by design; the first
 * SUPER_ADMIN is created via packages/db/scripts/create-admin.ts. */
export async function createAdminUser(input: CreateAdminUserInput) {
  const passwordHash = await hashPassword(input.password);
  return prisma.adminUser.create({
    data: {
      email: input.email,
      passwordHash,
      name: input.name,
      role: input.role,
    },
  });
}

export interface AdminAuthenticateResult {
  adminId: string;
  email: string;
  role: AdminRole;
  sessionVersion: number;
}

export async function adminAuthenticate(
  email: string,
  password: string,
): Promise<AdminAuthenticateResult | null> {
  const admin = await prisma.adminUser.findUnique({ where: { email } });
  if (!admin) return null;

  const passwordMatches = await verifyPassword(password, admin.passwordHash);
  if (!passwordMatches) return null;

  return {
    adminId: admin.id,
    email: admin.email,
    role: admin.role,
    sessionVersion: admin.sessionVersion,
  };
}

export function getAdminUser(id: string) {
  return prisma.adminUser.findUnique({ where: { id } });
}

/** Sets a new temporary password for an admin account - no email-sending
 * infrastructure exists in this app, so a temp password an admin hands off
 * directly is the practical equivalent of a reset-link flow. */
export async function setAdminPassword(id: string, newPassword: string) {
  const passwordHash = await hashPassword(newPassword);
  return prisma.adminUser.update({ where: { id }, data: { passwordHash } });
}
