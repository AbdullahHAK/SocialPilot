import { z } from "zod";

export const signupSchema = z.object({
  organizationName: z
    .string()
    .trim()
    .min(1, "Business name is required")
    .max(200),
  name: z.string().trim().max(200).optional().or(z.literal("")),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

const hexColor = z
  .string()
  .trim()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Enter a valid hex color");

export const brandProfileSchema = z.object({
  businessName: z.string().trim().min(1, "Business name is required").max(200),
  category: z.string().trim().max(100).optional().or(z.literal("")),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  colors: z.array(hexColor).max(6).default([]),
  language: z.string().trim().min(1, "Choose a language").max(50),
  tone: z.string().trim().max(200).optional().or(z.literal("")),
  productsServices: z
    .array(z.string().trim().min(1).max(200))
    .max(20)
    .default([]),
});

export type BrandProfileInput = z.infer<typeof brandProfileSchema>;

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

export const scheduleSlotSchema = z.object({
  dayOfWeek: z.enum([
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
    "SUNDAY",
  ]),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a time as HH:MM"),
  platform: z.enum(["INSTAGRAM", "FACEBOOK"]),
});

export type ScheduleSlotInput = z.infer<typeof scheduleSlotSchema>;

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a date as YYYY-MM-DD");
const hhmmTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a time as HH:MM");

export const oneTimePostSchema = z.object({
  date: isoDateSchema,
  time: hhmmTimeSchema,
  platform: z.enum(["INSTAGRAM", "FACEBOOK"]),
});

export type OneTimePostInput = z.infer<typeof oneTimePostSchema>;

const captionSchema = z.string().trim().max(2200, "Keep the caption under 2200 characters");

export const editContentPostSchema = z.object({
  caption: captionSchema,
  date: isoDateSchema,
  time: hhmmTimeSchema,
});

export type EditContentPostInput = z.infer<typeof editContentPostSchema>;

/** A published post's schedule can't change (it already went out) - only
 * the caption is still editable. */
export const editPublishedPostSchema = z.object({
  caption: captionSchema,
});

/** The IANA zone name a browser reports for "Add posting time" submissions,
 * so a picked time is interpreted as that person's local time rather than
 * literally the same clock reading in UTC. Validated against Intl itself
 * rather than a regex, since a bogus value would otherwise throw deep
 * inside the timezone-conversion code instead of failing validation. */
export const timezoneSchema = z.string().refine((value) => {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}, "Invalid timezone");
