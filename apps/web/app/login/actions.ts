"use server";

import { authenticate } from "@socialpilot/db";
import { redirect } from "next/navigation";
import type { AuthFormState } from "@/components/auth-form";
import { setSessionCookie } from "@/lib/session";
import { loginSchema } from "@/lib/validation";

export async function loginAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const result = await authenticate(parsed.data.email, parsed.data.password);
  if (!result) {
    return { error: "Invalid email or password." };
  }

  await setSessionCookie(result);
  redirect("/dashboard");
}
