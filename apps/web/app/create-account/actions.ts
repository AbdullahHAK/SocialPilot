"use server";

import {
  ActivationCodeInvalidError,
  decryptToken,
  EmailAlreadyInUseError,
  recordTermsAcceptance,
  redeemActivationCode,
  setStripeCustomer,
  signUp,
  SocialAccountAlreadyConnectedError,
  SocialAccountLimitError,
  syncSubscriptionFromStripe,
  upsertSocialAccount,
} from "@socialpilot/db";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import type { AuthFormState } from "@/components/auth-form";
import { notifyAdminNewCustomer, sendCustomerActivationEmail, sendCustomerConfirmationEmail } from "@/lib/notifications";
import { clearPendingSignupCookie, getPendingSignup } from "@/lib/pending-signup";
import { setSessionCookie } from "@/lib/session";
import { getStripeClient, mapStripeStatusToSubscriptionStatus, PLAN_DETAILS } from "@/lib/stripe";
import { createSignupSchema } from "@/lib/validation";

function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

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

  // The actual agree-before-paying gate already happened back on /pricing
  // (requireTermsAcceptance there redirects if the checkbox wasn't ticked);
  // this just persists the record it captured. A missing one here would
  // only mean a signup already in flight through an older cookie at the
  // exact moment this feature deployed - not worth blocking a legitimately
  // completed signup over.
  if (pending.termsAcceptance) {
    await recordTermsAcceptance({
      organizationId,
      version: pending.termsAcceptance.version,
      ipAddress: pending.termsAcceptance.ipAddress,
    });
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
        plan: pending.plan ?? null,
        status: mapStripeStatusToSubscriptionStatus(subscription.status),
        currentPeriodEnd: item?.current_period_end
          ? new Date(item.current_period_end * 1000)
          : null,
      });

      if (pending.plan) {
        await Promise.all([
          notifyAdminNewCustomer({
            businessName: parsed.data.organizationName,
            ownerEmail: parsed.data.email,
            plan: pending.plan,
            amountLabel: formatUsd(PLAN_DETAILS[pending.plan].cents),
            source: "card",
          }),
          sendCustomerConfirmationEmail(parsed.data.email, {
            businessName: parsed.data.organizationName,
            plan: pending.plan,
          }),
        ]);
      }
    }
  }

  // A stashed Page/Instagram account can turn out to already be connected
  // to a different organization by the time signup actually commits it -
  // e.g. the same admin-managed account reused across two customer
  // signups, or a page picked twice across retries. Confirmed live: this
  // was thrown uncaught, crashing the whole request with a raw 500 -
  // since signUp() above already created a real, valid user+organization
  // (with a working password), that crash didn't undo the signup, it just
  // orphaned it with no session ever set and no way to see what went
  // wrong. One page failing to attach must not lose the rest of a
  // legitimately completed signup - skip it and let the person connect
  // properly afterward from Connected Accounts (whose own connect flow
  // already surfaces this same error clearly).
  for (const page of pending.metaPages ?? []) {
    try {
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
        authMethod: page.authMethod,
      });
    } catch (error) {
      if (
        !(error instanceof SocialAccountAlreadyConnectedError) &&
        !(error instanceof SocialAccountLimitError)
      ) {
        throw error;
      }
      console.error(`Signup: couldn't attach a pending ${page.provider} account`, error);
    }
  }

  // The account already exists at this point regardless of whether the code
  // turns out to be valid, so an invalid/typo'd code doesn't block signup -
  // it can still be redeemed correctly later from /dashboard/subscription.
  // The one case that does need to surface clearly: a code the customer
  // chose on /pricing (already confirmed real and UNUSED there, read-only)
  // failing to redeem here means a genuine race - someone else claimed it
  // in the few minutes since - not a typo, so silently moving on would land
  // them on /onboarding thinking they paid/activated when they didn't.
  const activationCodeRaw = formData.get("activationCode");
  const activationCode =
    typeof activationCodeRaw === "string" ? activationCodeRaw.trim().toUpperCase() : "";
  let preValidatedCodeFailed = false;
  if (activationCode) {
    try {
      const redemption = await redeemActivationCode(activationCode, organizationId);
      await Promise.all([
        notifyAdminNewCustomer({
          businessName: parsed.data.organizationName,
          ownerEmail: parsed.data.email,
          plan: redemption.plan,
          amountLabel: "Activation code (no charge)",
          source: "code",
        }),
        sendCustomerActivationEmail(parsed.data.email, {
          businessName: parsed.data.organizationName,
          plan: redemption.plan,
          expiresAt: redemption.currentPeriodEnd,
        }),
      ]);
    } catch (error) {
      if (!(error instanceof ActivationCodeInvalidError)) throw error;
      if (activationCode === pending.activationCode?.trim().toUpperCase()) {
        preValidatedCodeFailed = true;
      }
    }
  }

  await setSessionCookie({ userId, organizationId, sessionVersion: 0 });
  await clearPendingSignupCookie();

  if (preValidatedCodeFailed) {
    redirect("/dashboard/subscription?codeError=1");
  }

  redirect("/onboarding");
}
