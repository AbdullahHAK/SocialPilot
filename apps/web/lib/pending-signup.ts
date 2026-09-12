import "server-only";
import { cookies } from "next/headers";
import {
  createPendingSignupToken,
  PENDING_SIGNUP_COOKIE_NAME,
  verifyPendingSignupToken,
  type PendingMetaPage,
  type PendingSignupPayload,
} from "./pending-signup-token";

export type { PendingMetaPage, PendingSignupPayload };

export async function setPendingSignupCookie(
  payload: PendingSignupPayload,
): Promise<void> {
  const token = await createPendingSignupToken(payload);
  const cookieStore = await cookies();
  cookieStore.set(PENDING_SIGNUP_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60,
  });
}

export async function clearPendingSignupCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(PENDING_SIGNUP_COOKIE_NAME);
}

export async function getPendingSignup(): Promise<PendingSignupPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(PENDING_SIGNUP_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyPendingSignupToken(token);
}
