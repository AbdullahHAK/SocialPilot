import { NextResponse, type NextRequest } from "next/server";
import { setPendingSignupCookie } from "@/lib/pending-signup";
import { getStripeClient, planForPriceId } from "@/lib/stripe";

/** Stripe Checkout's success_url for the pre-account flow. Retrieves the
 * completed session directly (rather than waiting on the async webhook) so
 * the visitor can continue straight into connecting their accounts. */
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.redirect(
      new URL("/pricing?error=missing_session", request.url),
    );
  }

  const stripe = getStripeClient();
  const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["line_items"],
  });

  if (checkoutSession.status !== "complete") {
    return NextResponse.redirect(
      new URL("/pricing?error=payment_incomplete", request.url),
    );
  }

  const priceId = checkoutSession.line_items?.data[0]?.price?.id;
  const plan = planForPriceId(priceId);
  if (!plan) {
    return NextResponse.redirect(
      new URL("/pricing?error=unknown_plan", request.url),
    );
  }

  const customerId =
    typeof checkoutSession.customer === "string"
      ? checkoutSession.customer
      : checkoutSession.customer?.id;
  const subscriptionId =
    typeof checkoutSession.subscription === "string"
      ? checkoutSession.subscription
      : checkoutSession.subscription?.id;

  if (!customerId || !subscriptionId) {
    return NextResponse.redirect(
      new URL("/pricing?error=missing_customer", request.url),
    );
  }

  await setPendingSignupCookie({
    plan,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
  });

  return NextResponse.redirect(new URL("/connect", request.url));
}
