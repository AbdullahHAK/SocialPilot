import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE_NAME = "sp_session";
const SESSION_DURATION = "30d";

export interface SessionPayload {
  userId: string;
  organizationId: string;
  /** Embedded at issuance and re-checked against the User row on every
   * getSession() call (apps/web/lib/session.ts) - the only way to revoke a
   * stateless JWT before it naturally expires. An admin's "force logout"
   * action increments the DB value, which immediately invalidates every
   * outstanding token carrying the old one. */
  sessionVersion: number;
}

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET environment variable is not set");
  }
  return new TextEncoder().encode(secret);
}

export function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ org: payload.organizationId, sv: payload.sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(SESSION_DURATION)
    .sign(getSecretKey());
}

export async function verifySessionToken(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (
      typeof payload.sub !== "string" ||
      typeof payload.org !== "string" ||
      typeof payload.sv !== "number"
    ) {
      return null;
    }
    return { userId: payload.sub, organizationId: payload.org, sessionVersion: payload.sv };
  } catch {
    return null;
  }
}
