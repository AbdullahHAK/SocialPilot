"use server";

import {
  ActivationCodeInvalidError,
  getSubscription,
  redeemActivationCode,
  setStripeCustomer,
} from "@socialpilot/db";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getStripeClient, PLAN_DETAILS, STRIPE_PRICE_IDS } from "@/lib/stripe";

const EXTENSION_LABELS: Record<"MONTHLY" | "SIX_MONTH" | "YEARLY", string> = {
  MONTHLY: "1-month extension",
  SIX_MONTH: "6-month extension",
  YEARLY: "1-year extension",
};

async function getBaseUrl(): Promise<string> {
  const headersList = await headers();
  const host = headersList.get("host");
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  return `${protocol}://${host}`;
}

export async function startCheckoutAction(formData: FormData) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const plan = formData.get("plan");
  if (plan !== "MONTHLY" && plan !== "SIX_MONTH" && plan !== "YEARLY") return;

  const stripe = getStripeClient();
  const existing = await getSubscription(session.organizationId);

  let customerId = existing?.stripeCustomerId ?? undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      metadata: { organizationId: session.organizationId },
    });
    customerId = customer.id;
    await setStripeCustomer({
      organizationId: session.organizationId,
      stripeCustomerId: customerId,
    });
  }

  const priceId = STRIPE_PRICE_IDS[plan]();
  const baseUrl = await getBaseUrl();

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/dashboard/subscription?checkout=success`,
    cancel_url: `${baseUrl}/dashboard/subscription?checkout=cancelled`,
  });

  if (!checkoutSession.url) {
    throw new Error("Stripe did not return a checkout URL");
  }
  redirect(checkoutSession.url);
}

/** A one-time Stripe payment (not a second recurring subscription) that adds
 * `durationDays` on top of whatever time the org already has left - see
 * extendSubscriptionByDuration. One-time avoids ever running two recurring
 * subscriptions in parallel for the same org, which would double-bill the
 * customer on their next renewal; the webhook applies the actual extension
 * once Stripe confirms the payment (checkout.session.completed), not here. */
export async function startExtensionCheckoutAction(formData: FormData) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const plan = formData.get("plan");
  if (plan !== "MONTHLY" && plan !== "SIX_MONTH" && plan !== "YEARLY") return;

  const stripe = getStripeClient();
  const existing = await getSubscription(session.organizationId);

  let customerId = existing?.stripeCustomerId ?? undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      metadata: { organizationId: session.organizationId },
    });
    customerId = customer.id;
    await setStripeCustomer({
      organizationId: session.organizationId,
      stripeCustomerId: customerId,
    });
  }

  const { cents, days } = PLAN_DETAILS[plan];
  const baseUrl = await getBaseUrl();

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: `YOPAPI - ${EXTENSION_LABELS[plan]}` },
          unit_amount: cents,
        },
        quantity: 1,
      },
    ],
    metadata: {
      type: "extension",
      organizationId: session.organizationId,
      plan,
      durationDays: String(days),
    },
    success_url: `${baseUrl}/dashboard/subscription?checkout=success`,
    cancel_url: `${baseUrl}/dashboard/subscription?checkout=cancelled`,
  });

  if (!checkoutSession.url) {
    throw new Error("Stripe did not return a checkout URL");
  }
  redirect(checkoutSession.url);
}

export async function redeemActivationCodeAction(formData: FormData) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  if (!code) {
    redirect("/dashboard/subscription?codeError=1");
  }

  try {
    await redeemActivationCode(code, session.organizationId);
  } catch (error) {
    if (error instanceof ActivationCodeInvalidError) {
      redirect("/dashboard/subscription?codeError=1");
    }
    throw error;
  }

  redirect("/dashboard/subscription?checkout=success");
}

export async function openBillingPortalAction() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const subscription = await getSubscription(session.organizationId);
  if (!subscription?.stripeCustomerId) {
    redirect("/dashboard/subscription");
  }

  const stripe = getStripeClient();
  const baseUrl = await getBaseUrl();

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${baseUrl}/dashboard/subscription`,
  });

  redirect(portalSession.url);
}
