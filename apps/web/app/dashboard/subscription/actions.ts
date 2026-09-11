"use server";

import { getSubscription, setStripeCustomer } from "@socialpilot/db";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getStripeClient, STRIPE_PRICE_IDS } from "@/lib/stripe";

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
  if (plan !== "MONTHLY" && plan !== "YEARLY") return;

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

  const priceId =
    plan === "MONTHLY" ? STRIPE_PRICE_IDS.MONTHLY() : STRIPE_PRICE_IDS.YEARLY();
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
