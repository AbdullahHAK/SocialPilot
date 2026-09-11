import type { SubscriptionPlan, SubscriptionStatus } from "@prisma/client";
import { prisma } from "./index";

export function getSubscription(organizationId: string) {
  return prisma.subscription.findUnique({ where: { organizationId } });
}

export interface SetStripeCustomerInput {
  organizationId: string;
  stripeCustomerId: string;
}

/** Records the Stripe customer for an org before checkout, so the webhook
 * can later look up the organization by stripeCustomerId alone. */
export function setStripeCustomer(input: SetStripeCustomerInput) {
  return prisma.subscription.upsert({
    where: { organizationId: input.organizationId },
    create: {
      organizationId: input.organizationId,
      stripeCustomerId: input.stripeCustomerId,
    },
    update: { stripeCustomerId: input.stripeCustomerId },
  });
}

export interface SyncSubscriptionFromStripeInput {
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  plan: SubscriptionPlan | null;
  status: SubscriptionStatus;
  currentPeriodEnd: Date | null;
}

/** Upserts subscription state from a Stripe webhook event, keyed by the
 * Stripe customer ID (the org may not be in the event payload directly). */
export async function syncSubscriptionFromStripe(
  input: SyncSubscriptionFromStripeInput,
) {
  const existing = await prisma.subscription.findUnique({
    where: { stripeCustomerId: input.stripeCustomerId },
  });
  if (!existing) return null;

  return prisma.subscription.update({
    where: { id: existing.id },
    data: {
      stripeSubscriptionId: input.stripeSubscriptionId,
      plan: input.plan,
      status: input.status,
      currentPeriodEnd: input.currentPeriodEnd,
    },
  });
}

export function isSubscriptionActive(
  subscription: { status: SubscriptionStatus } | null,
): boolean {
  return (
    subscription?.status === "ACTIVE" || subscription?.status === "TRIALING"
  );
}
