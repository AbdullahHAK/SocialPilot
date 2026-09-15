// Shared between server and client code (the language switcher needs
// SUPPORTED_LOCALES to render its options), so this file has no
// "server-only" guard, unlike lib/session.ts's cookie-touching helpers.

export const SUPPORTED_LOCALES = ["en", "fr", "ar"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

// Mirrors the sp_-prefixed convention used by lib/session-token.ts's
// SESSION_COOKIE_NAME. Not httpOnly (set in lib/locale-actions.ts) since
// the switcher itself never needs to read it back client-side - only to
// set it and then ask the server to re-render.
export const LOCALE_COOKIE_NAME = "sp_locale";

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  fr: "Français",
  ar: "العربية",
};

export const RTL_LOCALES: readonly Locale[] = ["ar"];

export function isSupportedLocale(value: string | undefined | null): value is Locale {
  return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function isRtl(locale: Locale): boolean {
  return (RTL_LOCALES as readonly string[]).includes(locale);
}
