"use server";

import { EmailAlreadyInUseError, signUp } from "@socialpilot/db";
import { redirect } from "next/navigation";
import type { AuthFormState } from "@/components/auth-form";
import { setSessionCookie } from "@/lib/session";
import { signupSchema } from "@/lib/validation";

export async function signupAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signupSchema.safeParse({
    organizationName: formData.get("organizationName"),
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const { userId, organizationId } = await signUp({
      organizationName: parsed.data.organizationName,
      name: parsed.data.name || undefined,
      email: parsed.data.email,
      password: parsed.data.password,
    });
    await setSessionCookie({ userId, organizationId });
  } catch (error) {
    if (error instanceof EmailAlreadyInUseError) {
      return { error: "An account with that email already exists." };
    }
    throw error;
  }

  redirect("/onboarding");
}
