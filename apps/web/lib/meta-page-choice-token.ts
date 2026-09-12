import { jwtVerify, SignJWT } from "jose";

export const META_PAGE_CHOICE_COOKIE_NAME = "sp_meta_page_choice";
const META_PAGE_CHOICE_DURATION = "10m";

export interface MetaPageChoice {
  id: string;
  name: string;
  hasInstagram: boolean;
}

export interface MetaPageChoicePayload {
  /** The long-lived user token, encrypted the same way as an at-rest
   * account token - needed to fetch the chosen Page's own token once
   * picked, since Meta only returns each Page's token in bulk once. */
  encryptedUserToken: string;
  choices: MetaPageChoice[];
  /** Whether to write straight to the DB (existing customer reconnecting)
   * or back into the pending-signup cookie (mid-signup, no org yet). */
  target: "session" | "pending";
}

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET environment variable is not set");
  }
  return new TextEncoder().encode(secret);
}

export function createMetaPageChoiceToken(
  payload: MetaPageChoicePayload,
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(META_PAGE_CHOICE_DURATION)
    .sign(getSecretKey());
}

function isMetaPageChoice(value: unknown): value is MetaPageChoice {
  if (!value || typeof value !== "object") return false;
  const choice = value as Record<string, unknown>;
  return (
    typeof choice.id === "string" &&
    typeof choice.name === "string" &&
    typeof choice.hasInstagram === "boolean"
  );
}

export async function verifyMetaPageChoiceToken(
  token: string,
): Promise<MetaPageChoicePayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (
      typeof payload.encryptedUserToken !== "string" ||
      (payload.target !== "session" && payload.target !== "pending") ||
      !Array.isArray(payload.choices)
    ) {
      return null;
    }
    const choices = payload.choices.filter(isMetaPageChoice);
    if (choices.length === 0) return null;

    return {
      encryptedUserToken: payload.encryptedUserToken,
      choices,
      target: payload.target,
    };
  } catch {
    return null;
  }
}
