import Stripe from "stripe";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is not set`);
  }
  return value;
}

let cachedClient: Stripe | undefined;

export function getStripeClient(): Stripe {
  cachedClient ??= new Stripe(requireEnv("STRIPE_SECRET_KEY"));
  return cachedClient;
}

/** Whether real billing is wired up yet. Lets the pricing flow fall back to
 * a no-payment "continue for now" path instead of crashing while the
 * client's Stripe account is still being sorted out. */
export function isStripeConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_PRICE_ID_MONTHLY &&
      process.env.STRIPE_PRICE_ID_SIXMONTH &&
      process.env.STRIPE_PRICE_ID_YEARLY,
  );
}

export const STRIPE_PRICE_IDS = {
  MONTHLY: () => requireEnv("STRIPE_PRICE_ID_MONTHLY"),
  SIX_MONTH: () => requireEnv("STRIPE_PRICE_ID_SIXMONTH"),
  YEARLY: () => requireEnv("STRIPE_PRICE_ID_YEARLY"),
} as const;

/** Derives our plan from the Stripe price actually purchased, rather than
 * trusting a client-suppliable value, since this feeds both the webhook and
 * the pre-account checkout-completion redirect. */
export function planForPriceId(
  priceId: string | undefined,
): "MONTHLY" | "SIX_MONTH" | "YEARLY" | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_ID_MONTHLY) return "MONTHLY";
  if (priceId === process.env.STRIPE_PRICE_ID_SIXMONTH) return "SIX_MONTH";
  if (priceId === process.env.STRIPE_PRICE_ID_YEARLY) return "YEARLY";
  return null;
}

export function mapStripeStatusToSubscriptionStatus(
  status: Stripe.Subscription.Status,
): "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "INCOMPLETE" {
  switch (status) {
    case "trialing":
      return "TRIALING";
    case "active":
      return "ACTIVE";
    case "past_due":
    case "unpaid":
      return "PAST_DUE";
    case "canceled":
    case "incomplete_expired":
      return "CANCELED";
    default:
      return "INCOMPLETE";
  }
}
