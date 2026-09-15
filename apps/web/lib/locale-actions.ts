"use server";

import { cookies } from "next/headers";
import { isSupportedLocale, LOCALE_COOKIE_NAME } from "@/lib/locale";

/** Called imperatively from the language switcher (a Client Component),
 * not via a <form action>, since it's a Select's onChange rather than a
 * submit. Same cookie conventions as lib/session.ts's setSessionCookie:
 * sameSite lax, path "/" - but not httpOnly (nothing server-only needs to
 * hide this from the client) and a long maxAge, since a language choice
 * should stick for a returning visitor, not just one session. */
export async function setLocaleAction(locale: string): Promise<void> {
  if (!isSupportedLocale(locale)) return;
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE_NAME, locale, {
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
