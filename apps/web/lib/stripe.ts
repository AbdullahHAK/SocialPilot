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

export const STRIPE_PRICE_IDS = {
  MONTHLY: () => requireEnv("STRIPE_PRICE_ID_MONTHLY"),
  YEARLY: () => requireEnv("STRIPE_PRICE_ID_YEARLY"),
} as const;

/** Derives our plan from the Stripe price actually purchased, rather than
 * trusting a client-suppliable value, since this feeds both the webhook and
 * the pre-account checkout-completion redirect. */
export function planForPriceId(
  priceId: string | undefined,
): "MONTHLY" | "YEARLY" | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_ID_MONTHLY) return "MONTHLY";
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
