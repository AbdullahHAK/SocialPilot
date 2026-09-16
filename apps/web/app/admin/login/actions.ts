"use server";

import { adminAuthenticate } from "@socialpilot/db";
import { redirect } from "next/navigation";
import { setAdminSessionCookie } from "@/lib/admin-session";

export interface AdminLoginFormState {
  error?: string;
}

export async function adminLoginAction(
  _prevState: AdminLoginFormState,
  formData: FormData,
): Promise<AdminLoginFormState> {
  const email = formData.get("email");
  const password = formData.get("password");
  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return { error: "Enter an email and password." };
  }

  const result = await adminAuthenticate(email, password);
  if (!result) {
    return { error: "Invalid email or password." };
  }

  await setAdminSessionCookie(result);
  redirect("/admin/customers");
}
