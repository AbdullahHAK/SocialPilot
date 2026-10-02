"use server";

import { isActivationCodeRedeemable } from "@socialpilot/db";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type Stripe from "stripe";
import { setPendingSignupCookie } from "@/lib/pending-signup";
import { getStripeClient, isStripeConfigured, STRIPE_PRICE_IDS } from "@/lib/stripe";

async function getBaseUrl(): Promise<string> {
  const headersList = await headers();
  const host = headersList.get("host");
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  return `${protocol}://${host}`;
}

/** Starts a Stripe Checkout session for a visitor who has no account yet -
 * Stripe collects the email and creates the customer itself. The result is
 * picked back up by /api/checkout/complete, which stashes the plan and
 * Stripe IDs in a pending-signup cookie until account creation.
 *
 * While billing isn't wired up yet (no Stripe account available), this
 * skips straight to Connect with no charge instead of crashing - matches
 * the client's own note that paywall enforcement isn't needed for this
 * round of testing. Remove this branch once real Stripe keys land. */
export async function startPendingCheckoutAction(formData: FormData) {
  const plan = formData.get("plan");
  if (plan !== "MONTHLY" && plan !== "SIX_MONTH" && plan !== "YEARLY") return;

  if (!isStripeConfigured()) {
    await setPendingSignupCookie({ plan });
    redirect("/connect");
  }

  const stripe = getStripeClient();
  const priceId = STRIPE_PRICE_IDS[plan]();
  const baseUrl = await getBaseUrl();

  let checkoutSession: Stripe.Checkout.Session;
  try {
    checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/api/checkout/complete?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/pricing?checkout=cancelled`,
    });
  } catch (error) {
    // A Stripe-side account misconfiguration (e.g. no payment methods
    // activated yet for the account/currency) or a transient API error
    // must not crash the request with a raw 500 - confirmed live the
    // moment real billing first went live. Distinguished from the
    // redirect() below, which Next.js implements by throwing - only a
    // genuine Stripe error should land here.
    console.error("Starting Stripe checkout failed", error);
    redirect("/pricing?error=checkout_session_failed");
  }

  if (!checkoutSession.url) {
    console.error("Stripe did not return a checkout URL", checkoutSession.id);
    redirect("/pricing?error=checkout_session_failed");
  }
  redirect(checkoutSession.url);
}

/** The code half of "pay by card or enter a code, right here on the pricing
 * page" - no account exists yet, so this only previews the code (read-only,
 * doesn't claim it) before stashing it in the pending-signup cookie. The
 * actual redemption happens in createAccountAction once an organization
 * exists to redeem it against. */
export async function startCodeSignupAction(formData: FormData) {
  const raw = formData.get("activationCode");
  const code = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  if (!code) {
    redirect("/pricing?error=code_required");
  }

  if (!(await isActivationCodeRedeemable(code))) {
    redirect("/pricing?error=invalid_code");
  }

  await setPendingSignupCookie({ activationCode: code });
  redirect("/create-account");
}
