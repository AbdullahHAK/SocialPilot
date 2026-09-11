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
