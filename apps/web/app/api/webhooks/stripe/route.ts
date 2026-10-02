import {
  claimStripeEvent,
  extendSubscriptionByDuration,
  prisma,
  syncSubscriptionFromStripe,
} from "@socialpilot/db";
import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import {
  getStripeClient,
  mapStripeStatusToSubscriptionStatus,
  planForPriceId,
} from "@/lib/stripe";

const SUBSCRIPTION_EVENTS = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

function extensionPlanFromMetadata(
  value: string | undefined,
): "MONTHLY" | "SIX_MONTH" | "YEARLY" | null {
  return value === "MONTHLY" || value === "SIX_MONTH" || value === "YEARLY" ? value : null;
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

  // Stripe can and does redeliver the same event (retries on a slow or
  // ambiguous response). Claiming the event id and acting on it inside one
  // transaction means a redelivery either no-ops entirely (already claimed)
  // or replays the full effect from a clean slate (a crash mid-handling
  // rolled both the claim and the effect back) - never a permanently-skipped
  // retry, and never a "+N days" extension silently applied twice.
  await prisma.$transaction(async (tx) => {
    const isNewEvent = await claimStripeEvent(event.id, tx);
    if (!isNewEvent) return;

    if (SUBSCRIPTION_EVENTS.has(event.type)) {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId =
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id;
      const item = subscription.items.data[0];

      await syncSubscriptionFromStripe(
        {
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscription.id,
          plan: planForPriceId(item?.price.id),
          status: mapStripeStatusToSubscriptionStatus(subscription.status),
          currentPeriodEnd: item?.current_period_end
            ? new Date(item.current_period_end * 1000)
            : null,
        },
        tx,
      );
    } else if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const isExtensionPurchase =
        session.mode === "payment" && session.metadata?.type === "extension";
      if (!isExtensionPurchase) return;

      const plan = extensionPlanFromMetadata(session.metadata?.plan);
      const organizationId = session.metadata?.organizationId;
      const durationDays = Number(session.metadata?.durationDays);

      if (
        session.payment_status === "paid" &&
        plan &&
        organizationId &&
        Number.isFinite(durationDays) &&
        durationDays > 0
      ) {
        await extendSubscriptionByDuration({ organizationId, plan, durationDays }, tx);
      } else {
        console.error(
          "Stripe checkout.session.completed extension had missing/invalid metadata",
          event.id,
        );
      }
    }
  });

  return NextResponse.json({ received: true });
}
