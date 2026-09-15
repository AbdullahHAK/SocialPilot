"use server";

import {
  decryptToken,
  EmailAlreadyInUseError,
  setStripeCustomer,
  signUp,
  syncSubscriptionFromStripe,
  upsertSocialAccount,
} from "@socialpilot/db";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import type { AuthFormState } from "@/components/auth-form";
import { clearPendingSignupCookie, getPendingSignup } from "@/lib/pending-signup";
import { setSessionCookie } from "@/lib/session";
import { getStripeClient, mapStripeStatusToSubscriptionStatus } from "@/lib/stripe";
import { createSignupSchema } from "@/lib/validation";

export async function createAccountAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const pending = await getPendingSignup();
  if (!pending) {
    redirect("/pricing");
  }

  const [tValidation, tAuth] = await Promise.all([
    getTranslations("validation"),
    getTranslations("auth"),
  ]);
  const parsed = createSignupSchema(tValidation).safeParse({
    organizationName: formData.get("organizationName"),
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? tAuth("invalidInput") };
  }

  let userId: string;
  let organizationId: string;
  try {
    const result = await signUp({
      organizationName: parsed.data.organizationName,
      name: parsed.data.name || undefined,
      email: parsed.data.email,
      password: parsed.data.password,
    });
    userId = result.userId;
    organizationId = result.organizationId;
  } catch (error) {
    if (error instanceof EmailAlreadyInUseError) {
      return { error: tAuth("emailInUse") };
    }
    throw error;
  }

  if (pending.stripeCustomerId) {
    await setStripeCustomer({
      organizationId,
      stripeCustomerId: pending.stripeCustomerId,
    });

    if (pending.stripeSubscriptionId) {
      const stripe = getStripeClient();
      const subscription = await stripe.subscriptions.retrieve(
        pending.stripeSubscriptionId,
      );
      const item = subscription.items.data[0];
      await syncSubscriptionFromStripe({
        stripeCustomerId: pending.stripeCustomerId,
        stripeSubscriptionId: subscription.id,
        plan: pending.plan,
        status: mapStripeStatusToSubscriptionStatus(subscription.status),
        currentPeriodEnd: item?.current_period_end
          ? new Date(item.current_period_end * 1000)
          : null,
      });
    }
  }

  for (const page of pending.metaPages ?? []) {
    await upsertSocialAccount({
      organizationId,
      provider: page.provider,
      externalId: page.externalId,
      displayName: page.displayName,
      profilePictureUrl: page.profilePictureUrl,
      accessToken: decryptToken(page.encryptedAccessToken),
      tokenExpiresAt: page.tokenExpiresAt
        ? new Date(page.tokenExpiresAt)
        : undefined,
    });
  }

  await setSessionCookie({ userId, organizationId });
  await clearPendingSignupCookie();

  redirect("/onboarding");
}
