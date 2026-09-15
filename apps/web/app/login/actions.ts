"use server";

import { authenticate } from "@socialpilot/db";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import type { AuthFormState } from "@/components/auth-form";
import { setSessionCookie } from "@/lib/session";
import { createLoginSchema } from "@/lib/validation";

export async function loginAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const [tValidation, tAuth] = await Promise.all([
    getTranslations("validation"),
    getTranslations("auth"),
  ]);
  const parsed = createLoginSchema(tValidation).safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? tAuth("invalidInput") };
  }

  const result = await authenticate(parsed.data.email, parsed.data.password);
  if (!result) {
    return { error: tAuth("invalidCredentials") };
  }

  await setSessionCookie(result);
  redirect("/dashboard");
}
