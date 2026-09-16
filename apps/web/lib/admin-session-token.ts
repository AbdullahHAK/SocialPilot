import { jwtVerify, SignJWT } from "jose";
import type { AdminRole } from "@socialpilot/db";

export const ADMIN_SESSION_COOKIE_NAME = "sp_admin_session";
const ADMIN_SESSION_DURATION = "12h";

export interface AdminSessionPayload {
  adminId: string;
  email: string;
  role: AdminRole;
  sessionVersion: number;
}

// Deliberately the same AUTH_SECRET as customer sessions (one less secret
// to provision), but a completely separate cookie name and payload shape -
// an admin token and a customer token can never be confused for each other
// since apps/web/lib/session.ts only ever reads sp_session and
// admin-session.ts only ever reads sp_admin_session.
function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET environment variable is not set");
  }
  return new TextEncoder().encode(secret);
}

export function createAdminSessionToken(payload: AdminSessionPayload): Promise<string> {
  return new SignJWT({ email: payload.email, role: payload.role, sv: payload.sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.adminId)
    .setIssuedAt()
    .setExpirationTime(ADMIN_SESSION_DURATION)
    .sign(getSecretKey());
}

export async function verifyAdminSessionToken(
  token: string,
): Promise<AdminSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (
      typeof payload.sub !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.role !== "string" ||
      typeof payload.sv !== "number"
    ) {
      return null;
    }
    return {
      adminId: payload.sub,
      email: payload.email,
      role: payload.role as AdminRole,
      sessionVersion: payload.sv,
    };
  } catch {
    return null;
  }
}
