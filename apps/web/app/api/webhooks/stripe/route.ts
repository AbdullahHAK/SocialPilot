import { syncSubscriptionFromStripe } from "@socialpilot/db";
import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripeClient, mapStripeStatusToSubscriptionStatus } from "@/lib/stripe";

const SUBSCRIPTION_EVENTS = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

function planForPriceId(priceId: string | undefined): "MONTHLY" | "YEARLY" | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_ID_MONTHLY) return "MONTHLY";
  if (priceId === process.env.STRIPE_PRICE_ID_YEARLY) return "YEARLY";
  return null;
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    console.error("Stripe webhook missing signature header or secret");
    return NextResponse.json({ error: "Not configured" }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripeClient().webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret,
    );
  } catch (error) {
    console.error("Stripe webhook signature verification failed", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (SUBSCRIPTION_EVENTS.has(event.type)) {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId =
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer.id;
    const item = subscription.items.data[0];

    await syncSubscriptionFromStripe({
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      plan: planForPriceId(item?.price.id),
      status: mapStripeStatusToSubscriptionStatus(subscription.status),
      currentPeriodEnd: item?.current_period_end
        ? new Date(item.current_period_end * 1000)
        : null,
    });
  }

  return NextResponse.json({ received: true });
}
