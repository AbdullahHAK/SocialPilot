import "server-only";
import { prisma } from "@socialpilot/db";
import { cookies } from "next/headers";
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
  verifySessionToken,
  type SessionPayload,
} from "./session-token";

export type { SessionPayload };

export async function setSessionCookie(payload: SessionPayload): Promise<void> {
  const token = await createSessionToken(payload);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/** Verifies the JWT itself, then checks its embedded sessionVersion against
 * the User row's current value - this DB round trip is what makes "force
 * logout" (an admin incrementing sessionVersion) actually take effect,
 * something a pure stateless JWT check could never support. A mismatch
 * (or a user that no longer exists) is treated exactly like no session at
 * all, so every existing `if (!session) redirect("/login")` call site
 * already handles it correctly with no changes needed there. */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await verifySessionToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { sessionVersion: true },
  });
  if (!user || user.sessionVersion !== payload.sessionVersion) return null;

  return payload;
}
