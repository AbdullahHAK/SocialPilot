import "server-only";
import { cookies } from "next/headers";
import {
  createMetaPageChoiceToken,
  META_PAGE_CHOICE_COOKIE_NAME,
  verifyMetaPageChoiceToken,
  type MetaPageChoice,
  type MetaPageChoicePayload,
} from "./meta-page-choice-token";

export type { MetaPageChoice, MetaPageChoicePayload };

export async function setMetaPageChoiceCookie(
  payload: MetaPageChoicePayload,
): Promise<void> {
  const token = await createMetaPageChoiceToken(payload);
  const cookieStore = await cookies();
  cookieStore.set(META_PAGE_CHOICE_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });
}

export async function clearMetaPageChoiceCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(META_PAGE_CHOICE_COOKIE_NAME);
}

export async function getMetaPageChoice(): Promise<MetaPageChoicePayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(META_PAGE_CHOICE_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyMetaPageChoiceToken(token);
}
