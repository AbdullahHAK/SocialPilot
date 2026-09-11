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
