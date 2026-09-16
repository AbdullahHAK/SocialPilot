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

/** Extends (positive) or reduces (negative) a subscription's expiration by
 * a number of days, e.g. "+15 days" or "-5 days" as compensation/correction.
 * Bases off `now` rather than erroring when there's no existing
 * subscription/currentPeriodEnd yet - an admin doing this for a fresh
 * no-subscription org should just get one created starting now. */
export async function adjustSubscriptionDays(
  organizationId: string,
  deltaDays: number,
): Promise<Date> {
  const existing = await prisma.subscription.findUnique({ where: { organizationId } });
  const base = existing?.currentPeriodEnd ?? new Date();
  const newExpiration = new Date(base.getTime() + deltaDays * 24 * 60 * 60 * 1000);

  await prisma.subscription.upsert({
    where: { organizationId },
    create: { organizationId, status: "ACTIVE", currentPeriodEnd: newExpiration },
    update: { currentPeriodEnd: newExpiration },
  });
  return newExpiration;
}

export function setSubscriptionExpiration(organizationId: string, expiration: Date) {
  return prisma.subscription.upsert({
    where: { organizationId },
    create: { organizationId, status: "ACTIVE", currentPeriodEnd: expiration },
    update: { currentPeriodEnd: expiration },
  });
}

/** Direct admin activation with no code and no payment - the client's
 * "direct activation in the account name" requirement, for friends he
 * activates by hand. */
export function manuallyActivateSubscription(
  organizationId: string,
  plan: SubscriptionPlan,
  durationDays: number,
) {
  const currentPeriodEnd = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
  return prisma.subscription.upsert({
    where: { organizationId },
    create: { organizationId, plan, status: "ACTIVE", currentPeriodEnd },
    update: { plan, status: "ACTIVE", currentPeriodEnd },
  });
}

export function setSubscriptionStatus(
  organizationId: string,
  status: Extract<SubscriptionStatus, "PAUSED" | "CANCELED" | "ACTIVE">,
) {
  return prisma.subscription.update({
    where: { organizationId },
    data: { status },
  });
}
