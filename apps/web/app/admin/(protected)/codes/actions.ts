"use server";

import {
  generateActivationCodes,
  logAdminAction,
  setActivationCodeDisabled,
  type SubscriptionPlan,
} from "@socialpilot/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-session";
import { requireAdminRole } from "@/lib/admin-permissions";

async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  return session;
}

export async function generateCodesAction(formData: FormData) {
  const session = await requireAdmin();
  requireAdminRole(session.role, ["SUPER_ADMIN", "ADMIN"]);

  const count = Math.min(Math.max(Number(formData.get("count")) || 1, 1), 1000);
  const plan = String(formData.get("plan")) as SubscriptionPlan;
  const durationDays = Number(formData.get("durationDays")) || 30;
  const expiresRaw = formData.get("expiresAt");
  const expiresAt =
    typeof expiresRaw === "string" && expiresRaw ? new Date(expiresRaw) : null;

  const codes = await generateActivationCodes({
    count,
    plan,
    durationDays,
    expiresAt,
    createdByAdminId: session.adminId,
  });

  await logAdminAction({
    adminId: session.adminId,
    adminEmail: session.email,
    action: "activationCode.generate",
    targetType: "activationCode",
    details: { count: codes.length, plan, durationDays },
  });

  revalidatePath("/admin/codes");
}

export async function toggleCodeDisabledAction(id: string, disabled: boolean) {
  const session = await requireAdmin();
  requireAdminRole(session.role, ["SUPER_ADMIN", "ADMIN"]);

  const changed = await setActivationCodeDisabled(id, disabled);
  if (changed) {
    await logAdminAction({
      adminId: session.adminId,
      adminEmail: session.email,
      action: disabled ? "activationCode.disable" : "activationCode.enable",
      targetType: "activationCode",
      targetId: id,
    });
  }
  revalidatePath("/admin/codes");
}
