import { z } from "zod";

// Schemas are built as factories rather than module-level constants because
// their messages need the request's locale - and the locale (a cookie read
// via next/headers) isn't known until a request is actually in flight, long
// after this module has already loaded. Every call site fetches a
// getTranslations("validation") translator and passes it in here.
export type Translate = (key: string) => string;

export function createSignupSchema(t: Translate) {
  return z.object({
    organizationName: z.string().trim().min(1, t("businessNameRequired")).max(200),
    name: z.string().trim().max(200).optional().or(z.literal("")),
    email: z.string().trim().toLowerCase().email(t("invalidEmail")),
    password: z.string().min(8, t("passwordMinLength")).max(200),
  });
}
export type SignupInput = z.infer<ReturnType<typeof createSignupSchema>>;

export function createLoginSchema(t: Translate) {
  return z.object({
    email: z.string().trim().toLowerCase().email(t("invalidEmail")),
    password: z.string().min(1, t("passwordRequired")),
  });
}
export type LoginInput = z.infer<ReturnType<typeof createLoginSchema>>;

function hexColorSchema(t: Translate) {
  return z
    .string()
    .trim()
    .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, t("invalidHexColor"));
}

export function createBrandProfileSchema(t: Translate) {
  return z.object({
    businessName: z.string().trim().min(1, t("businessNameRequired")).max(200),
    category: z.string().trim().max(100).optional().or(z.literal("")),
    description: z.string().trim().max(2000).optional().or(z.literal("")),
    colors: z.array(hexColorSchema(t)).max(6).default([]),
    language: z.string().trim().min(1, t("chooseLanguage")).max(50),
    tone: z.string().trim().max(200).optional().or(z.literal("")),
    productsServices: z
      .array(z.string().trim().min(1).max(200))
      .max(20)
      .default([]),
  });
}
export type BrandProfileInput = z.infer<ReturnType<typeof createBrandProfileSchema>>;

export const LOGO_MAX_BYTES = 4 * 1024 * 1024;
export const LOGO_ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
];

export const REFERENCE_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
export const REFERENCE_IMAGE_MAX_COUNT = 4;
export const REFERENCE_IMAGE_ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
];

export function createScheduleSlotSchema(t: Translate) {
  return z.object({
    dayOfWeek: z.enum([
      "MONDAY",
      "TUESDAY",
      "WEDNESDAY",
      "THURSDAY",
      "FRIDAY",
      "SATURDAY",
      "SUNDAY",
    ]),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, t("invalidTime")),
    platform: z.enum(["INSTAGRAM", "FACEBOOK"]),
  });
}
export type ScheduleSlotInput = z.infer<ReturnType<typeof createScheduleSlotSchema>>;

function isoDateSchema(t: Translate) {
  return z.string().regex(/^\d{4}-\d{2}-\d{2}$/, t("invalidDate"));
}
function hhmmTimeSchema(t: Translate) {
  return z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, t("invalidTime"));
}

export function createOneTimePostSchema(t: Translate) {
  return z.object({
    date: isoDateSchema(t),
    time: hhmmTimeSchema(t),
    platform: z.enum(["INSTAGRAM", "FACEBOOK"]),
  });
}
export type OneTimePostInput = z.infer<ReturnType<typeof createOneTimePostSchema>>;

function captionSchema(t: Translate) {
  return z.string().trim().max(2200, t("captionTooLong"));
}

export function createEditContentPostSchema(t: Translate) {
  return z.object({
    caption: captionSchema(t),
    date: isoDateSchema(t),
    time: hhmmTimeSchema(t),
  });
}
export type EditContentPostInput = z.infer<ReturnType<typeof createEditContentPostSchema>>;

/** A published post's schedule can't change (it already went out) - only
 * the caption is still editable. */
export function createEditPublishedPostSchema(t: Translate) {
  return z.object({
    caption: captionSchema(t),
  });
}

/** The IANA zone name a browser reports for "Add posting time" submissions,
 * so a picked time is interpreted as that person's local time rather than
 * literally the same clock reading in UTC. Validated against Intl itself
 * rather than a regex, since a bogus value would otherwise throw deep
 * inside the timezone-conversion code instead of failing validation. */
export function createTimezoneSchema(t: Translate) {
  return z.string().refine((value) => {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, t("invalidTimezone"));
}
