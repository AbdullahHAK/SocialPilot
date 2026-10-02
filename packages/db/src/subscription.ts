import type { Prisma, SubscriptionPlan, SubscriptionStatus } from "@prisma/client";
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
 * Stripe customer ID (the org may not be in the event payload directly).
 * Takes an optional transaction client so the webhook route can commit this
 * atomically alongside its idempotency-claim insert. */
export async function syncSubscriptionFromStripe(
  input: SyncSubscriptionFromStripeInput,
  client: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const existing = await client.subscription.findUnique({
    where: { stripeCustomerId: input.stripeCustomerId },
  });
  if (!existing) return null;

  return client.subscription.update({
    where: { id: existing.id },
    data: {
      stripeSubscriptionId: input.stripeSubscriptionId,
      plan: input.plan,
      status: input.status,
      currentPeriodEnd: input.currentPeriodEnd,
    },
  });
}

/** The single source of truth for "does this org currently have paid
 * access" - used both to gate cost-incurring actions (logo/content
 * generation, publishing) and to decide what the subscription page shows.
 * currentPeriodEnd matters because nothing else in this product expires a
 * subscription automatically: manuallyActivateSubscription and activation
 * code redemption both set status ACTIVE up front with a real expiry date,
 * so without this check here, access would silently continue forever past
 * whatever period the customer actually paid/was activated for. A missing
 * currentPeriodEnd is treated as "no expiry" rather than "expired" - some
 * Stripe subscription states don't carry one. */
export function isSubscriptionActive(
  subscription: { status: SubscriptionStatus; currentPeriodEnd?: Date | null } | null,
): boolean {
  if (!subscription) return false;
  if (subscription.status !== "ACTIVE" && subscription.status !== "TRIALING") {
    return false;
  }
  if (subscription.currentPeriodEnd && subscription.currentPeriodEnd < new Date()) {
    return false;
  }
  return true;
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

export interface ExtendSubscriptionInput {
  organizationId: string;
  plan: SubscriptionPlan;
  durationDays: number;
}

/** Adds durationDays on top of whichever is later: now, or the
 * subscription's existing currentPeriodEnd. This is the "buy more time"
 * primitive behind both the paid (Stripe one-time payment) and
 * activation-code extension paths - a customer with 4 months left who buys
 * 6 more ends up with 10, not 6. Contrast with manuallyActivateSubscription
 * and adjustSubscriptionDays above, which are admin corrections that
 * intentionally don't stack on top of remaining time. Takes an optional
 * transaction client so callers that need the extension atomic with another
 * write (e.g. redeemActivationCode's code-claim) can pass their `tx`. */
export async function extendSubscriptionByDuration(
  input: ExtendSubscriptionInput,
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<Date> {
  const existing = await client.subscription.findUnique({
    where: { organizationId: input.organizationId },
  });
  const now = new Date();
  const base =
    existing?.currentPeriodEnd && existing.currentPeriodEnd > now
      ? existing.currentPeriodEnd
      : now;
  const currentPeriodEnd = new Date(
    base.getTime() + input.durationDays * 24 * 60 * 60 * 1000,
  );

  await client.subscription.upsert({
    where: { organizationId: input.organizationId },
    create: {
      organizationId: input.organizationId,
      plan: input.plan,
      status: "ACTIVE",
      currentPeriodEnd,
    },
    update: { plan: input.plan, status: "ACTIVE", currentPeriodEnd },
  });
  return currentPeriodEnd;
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
