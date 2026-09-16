import "server-only";
import { prisma } from "@socialpilot/db";
import { cookies } from "next/headers";
import {
  ADMIN_SESSION_COOKIE_NAME,
  createAdminSessionToken,
  verifyAdminSessionToken,
  type AdminSessionPayload,
} from "./admin-session-token";

export type { AdminSessionPayload };

export async function setAdminSessionCookie(payload: AdminSessionPayload): Promise<void> {
  const token = await createAdminSessionToken(payload);
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function clearAdminSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE_NAME);
}

export async function getAdminSession(): Promise<AdminSessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await verifyAdminSessionToken(token);
  if (!payload) return null;

  const admin = await prisma.adminUser.findUnique({
    where: { id: payload.adminId },
    select: { sessionVersion: true, role: true },
  });
  if (!admin || admin.sessionVersion !== payload.sessionVersion) return null;

  // Role is re-read from the DB rather than trusted from the token, so a
  // role change takes effect on the admin's very next request, not just
  // their next login.
  return { ...payload, role: admin.role };
}
