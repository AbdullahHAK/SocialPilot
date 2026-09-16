"use server";

import { randomBytes } from "node:crypto";
import {
  adjustSubscriptionDays,
  forceLogoutOrganization,
  logAdminAction,
  manuallyActivateSubscription,
  redeemActivationCode,
  setOrganizationStatus,
  setSubscriptionExpiration,
  setSubscriptionStatus,
  setUserPassword,
  type OrganizationStatus,
  type SubscriptionPlan,
} from "@socialpilot/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-session";
import { AdminPermissionError, requireAdminRole } from "@/lib/admin-permissions";

async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  return session;
}

async function log(
  session: { adminId: string; email: string },
  action: string,
  targetId: string,
  details?: Record<string, unknown>,
) {
  await logAdminAction({
    adminId: session.adminId,
    adminEmail: session.email,
    action,
    targetType: "organization",
    targetId,
    // Serialized through JSON round-trip (Dates -> ISO strings, etc.) since
    // this is a loosely-typed audit record, not something needing strict
    // compile-time JSON-value typing.
    details: details ? JSON.parse(JSON.stringify(details)) : undefined,
  });
}

export async function setStatusAction(organizationId: string, status: OrganizationStatus) {
  const session = await requireAdmin();
  if (status === "DELETED") {
    requireAdminRole(session.role, ["SUPER_ADMIN", "ADMIN"]);
  } else {
    requireAdminRole(session.role, ["SUPER_ADMIN", "ADMIN", "SUPPORT"]);
  }

  await setOrganizationStatus(organizationId, status);
  await log(session, `customer.status.${status.toLowerCase()}`, organizationId, { status });
  revalidatePath(`/admin/customers/${organizationId}`);
}

export async function forceLogoutAction(organizationId: string) {
  const session = await requireAdmin();
  requireAdminRole(session.role, ["SUPER_ADMIN", "ADMIN", "SUPPORT"]);

  const count = await forceLogoutOrganization(organizationId);
  await log(session, "customer.forceLogout", organizationId, { sessionsInvalidated: count });
  revalidatePath(`/admin/customers/${organizationId}`);
}

export interface ResetAccessState {
  temporaryPassword?: string;
  error?: string;
}

export async function resetAccessAction(
  organizationId: string,
  userId: string,
  // Required by useActionState's (prevState, formData) contract via the
  // curried binding in reset-access-button.tsx, but this action never
  // needs the previous state's value.
  prevState: ResetAccessState,
): Promise<ResetAccessState> {
  void prevState;
  const session = await requireAdmin();
  try {
    requireAdminRole(session.role, ["SUPER_ADMIN", "ADMIN", "SUPPORT"]);
  } catch (error) {
    if (error instanceof AdminPermissionError) return { error: error.message };
    throw error;
  }

  const temporaryPassword = randomBytes(9).toString("base64url");
  await setUserPassword(userId, temporaryPassword);
  await log(session, "customer.resetAccess", organizationId, { userId });
  revalidatePath(`/admin/customers/${organizationId}`);

  return { temporaryPassword };
}

export async function adjustSubscriptionDaysAction(formData: FormData) {
  const session = await requireAdmin();
  requireAdminRole(session.role, ["SUPER_ADMIN", "ADMIN"]);

  const organizationId = String(formData.get("organizationId"));
  const deltaDays = Number(formData.get("deltaDays"));
  if (!Number.isFinite(deltaDays) || deltaDays === 0) {
    redirect(`/admin/customers/${organizationId}`);
  }

  const newExpiration = await adjustSubscriptionDays(organizationId, deltaDays);
  await log(session, "subscription.adjustDays", organizationId, {
    deltaDays,
    newExpiration,
  });
  revalidatePath(`/admin/customers/${organizationId}`);
}

export async function setExpirationAction(formData: FormData) {
  const session = await requireAdmin();
  requireAdminRole(session.role, ["SUPER_ADMIN", "ADMIN"]);

  const organizationId = String(formData.get("organizationId"));
  const dateValue = String(formData.get("expiration"));
  const expiration = new Date(dateValue);
  if (Number.isNaN(expiration.getTime())) {
    redirect(`/admin/customers/${organizationId}`);
  }

  await setSubscriptionExpiration(organizationId, expiration);
  await log(session, "subscription.setExpiration", organizationId, { expiration });
  revalidatePath(`/admin/customers/${organizationId}`);
}

export async function manualActivateAction(formData: FormData) {
  const session = await requireAdmin();
  requireAdminRole(session.role, ["SUPER_ADMIN", "ADMIN"]);

  const organizationId = String(formData.get("organizationId"));
  const plan = String(formData.get("plan")) as SubscriptionPlan;
  const durationDays = Number(formData.get("durationDays"));
  if (!durationDays || durationDays <= 0) {
    redirect(`/admin/customers/${organizationId}`);
  }

  await manuallyActivateSubscription(organizationId, plan, durationDays);
  await log(session, "subscription.manualActivate", organizationId, { plan, durationDays });
  revalidatePath(`/admin/customers/${organizationId}`);
}

export async function setSubscriptionStatusAction(
  organizationId: string,
  status: "PAUSED" | "CANCELED" | "ACTIVE",
) {
  const session = await requireAdmin();
  requireAdminRole(session.role, ["SUPER_ADMIN", "ADMIN"]);

  await setSubscriptionStatus(organizationId, status);
  await log(session, `subscription.${status.toLowerCase()}`, organizationId, { status });
  revalidatePath(`/admin/customers/${organizationId}`);
}

export async function redeemCodeForCustomerAction(formData: FormData) {
  const session = await requireAdmin();
  requireAdminRole(session.role, ["SUPER_ADMIN", "ADMIN"]);

  const organizationId = String(formData.get("organizationId"));
  const code = String(formData.get("code")).trim().toUpperCase();
  if (!code) redirect(`/admin/customers/${organizationId}`);

  try {
    await redeemActivationCode(code, organizationId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not redeem this code";
    redirect(`/admin/customers/${organizationId}?error=${encodeURIComponent(message)}`);
  }
  await log(session, "subscription.redeemCode", organizationId, { code });
  revalidatePath(`/admin/customers/${organizationId}`);
}
