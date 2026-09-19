"use server";

import {
  ActivationCodeInvalidError,
  createOrganizationForUser,
  deleteOrganization,
  isOrganizationMember,
  redeemActivationCode,
} from "@socialpilot/db";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { getSession, setSessionCookie } from "@/lib/session";

/** No redirect - the caller does router.refresh() so whichever dashboard
 * page you're already on re-renders with the new business's data instead
 * of bouncing you back to the overview. */
export async function switchOrganizationAction(organizationId: string) {
  const session = await getSession();
  if (!session) redirect("/login");

  const allowed = await isOrganizationMember(session.userId, organizationId);
  if (!allowed) return;

  await setSessionCookie({ ...session, organizationId });
}

export interface AddBusinessFormState {
  error?: string;
}

/** A second (or third...) business under the same login, each with its own
 * Page/Instagram and its own subscription (activation code) - the client's
 * explicit request: "select whichever you like from the dashboard,
 * subscription per business, same account." */
export async function addBusinessAction(
  _prevState: AddBusinessFormState,
  formData: FormData,
): Promise<AddBusinessFormState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const t = await getTranslations("dashboard.addBusiness");
  const name = formData.get("businessName")?.toString().trim();
  const code = formData.get("activationCode")?.toString().trim();
  if (!name) return { error: t("nameRequired") };
  if (!code) return { error: t("codeRequired") };

  const org = await createOrganizationForUser(session.userId, name);

  try {
    await redeemActivationCode(code, org.id);
  } catch (error) {
    await deleteOrganization(org.id);
    if (error instanceof ActivationCodeInvalidError) {
      return { error: t("invalidCode") };
    }
    throw error;
  }

  await setSessionCookie({ ...session, organizationId: org.id });
  redirect("/onboarding");
}
