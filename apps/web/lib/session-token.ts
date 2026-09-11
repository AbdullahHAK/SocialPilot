import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE_NAME = "sp_session";
const SESSION_DURATION = "30d";

export interface SessionPayload {
  userId: string;
  organizationId: string;
}

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET environment variable is not set");
  }
  return new TextEncoder().encode(secret);
}

export function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ org: payload.organizationId })
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
    if (typeof payload.sub !== "string" || typeof payload.org !== "string") {
      return null;
    }
    return { userId: payload.sub, organizationId: payload.org };
  } catch {
    return null;
  }
}
