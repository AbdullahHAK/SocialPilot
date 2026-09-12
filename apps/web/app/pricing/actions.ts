"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getStripeClient, STRIPE_PRICE_IDS } from "@/lib/stripe";

async function getBaseUrl(): Promise<string> {
  const headersList = await headers();
  const host = headersList.get("host");
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  return `${protocol}://${host}`;
}

/** Starts a Stripe Checkout session for a visitor who has no account yet -
 * Stripe collects the email and creates the customer itself. The result is
 * picked back up by /api/checkout/complete, which stashes the plan and
 * Stripe IDs in a pending-signup cookie until account creation. */
export async function startPendingCheckoutAction(formData: FormData) {
  const plan = formData.get("plan");
  if (plan !== "MONTHLY" && plan !== "YEARLY") return;

  const stripe = getStripeClient();
  const priceId =
    plan === "MONTHLY" ? STRIPE_PRICE_IDS.MONTHLY() : STRIPE_PRICE_IDS.YEARLY();
  const baseUrl = await getBaseUrl();

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/api/checkout/complete?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/pricing?checkout=cancelled`,
  });

  if (!checkoutSession.url) {
    throw new Error("Stripe did not return a checkout URL");
  }
  redirect(checkoutSession.url);
}
