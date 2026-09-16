import { jwtVerify, SignJWT } from "jose";
import type { SocialProvider } from "@socialpilot/db";

export const PENDING_SIGNUP_COOKIE_NAME = "sp_pending_signup";
const PENDING_SIGNUP_DURATION = "1h";

export interface PendingMetaPage {
  provider: SocialProvider;
  externalId: string;
  displayName?: string;
  profilePictureUrl?: string;
  encryptedAccessToken: string;
  tokenExpiresAt?: string;
}

export interface PendingSignupPayload {
  plan: "MONTHLY" | "SIX_MONTH" | "YEARLY";
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  metaPages?: PendingMetaPage[];
}

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET environment variable is not set");
  }
  return new TextEncoder().encode(secret);
}

export function createPendingSignupToken(
  payload: PendingSignupPayload,
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(PENDING_SIGNUP_DURATION)
    .sign(getSecretKey());
}

function isPendingMetaPage(value: unknown): value is PendingMetaPage {
  if (!value || typeof value !== "object") return false;
  const page = value as Record<string, unknown>;
  return (
    (page.provider === "FACEBOOK" || page.provider === "INSTAGRAM") &&
    typeof page.externalId === "string" &&
    typeof page.encryptedAccessToken === "string"
  );
}

export async function verifyPendingSignupToken(
  token: string,
): Promise<PendingSignupPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (
      payload.plan !== "MONTHLY" &&
      payload.plan !== "SIX_MONTH" &&
      payload.plan !== "YEARLY"
    ) {
      return null;
    }

    const metaPages = Array.isArray(payload.metaPages)
      ? payload.metaPages.filter(isPendingMetaPage)
      : undefined;

    return {
      plan: payload.plan,
      stripeCustomerId:
        typeof payload.stripeCustomerId === "string"
          ? payload.stripeCustomerId
          : undefined,
      stripeSubscriptionId:
        typeof payload.stripeSubscriptionId === "string"
          ? payload.stripeSubscriptionId
          : undefined,
      metaPages,
    };
  } catch {
    return null;
  }
}
