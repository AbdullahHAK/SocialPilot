import { getSubscription, isSubscriptionActive } from "@socialpilot/db";
import { AlertCircle, Check, CheckCircle2 } from "lucide-react";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSession } from "@/lib/session";
import { openBillingPortalAction, startCheckoutAction } from "./actions";

const PLANS = [
  {
    id: "MONTHLY" as const,
    name: "Monthly",
    price: "$49",
    cadence: "/month",
    description: "Full access, billed every month.",
    featured: false,
  },
  {
    id: "YEARLY" as const,
    name: "Yearly",
    price: "$470",
    cadence: "/year",
    description: "Full access, billed annually — about 20% cheaper.",
    featured: true,
  },
];

const PLAN_FEATURES = [
  "AI-generated content, on-brand",
  "Automatic publishing to Instagram & Facebook",
  "Unlimited weekly publishing slots",
  "Full content calendar & history",
];

export default async function SubscriptionPage({
  searchParams,
}: PageProps<"/dashboard/subscription">) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const { checkout } = await searchParams;
  const subscription = await getSubscription(session.organizationId);
  const active = isSubscriptionActive(subscription);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Subscription</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your YOPAPI plan and billing details.
        </p>
      </div>

      {checkout === "success" && (
        <div className="flex items-center gap-2.5 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          <CheckCircle2 className="size-4 shrink-0" />
          Subscription confirmed — thanks!
        </div>
      )}
      {checkout === "cancelled" && (
        <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Checkout was cancelled — no charges were made.
        </div>
      )}
      {subscription?.status === "PAST_DUE" && (
        <div className="flex items-center gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          Your last payment failed. Update your payment method to keep
          YOPAPI running.
        </div>
      )}

      {active && subscription ? (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>
                {subscription.plan === "YEARLY" ? "Yearly" : "Monthly"} plan
              </CardTitle>
              <Badge variant="success">
                {subscription.status === "TRIALING" ? "Trialing" : "Active"}
              </Badge>
            </div>
            {subscription.currentPeriodEnd && (
              <CardDescription>
                Renews {subscription.currentPeriodEnd.toLocaleDateString()}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <form action={openBillingPortalAction}>
              <Button type="submit" variant="outline">
                Manage billing
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {PLANS.map((plan) => (
            <Card
              key={plan.id}
              className={plan.featured ? "border-primary shadow-md" : undefined}
            >
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle>{plan.name}</CardTitle>
                  {plan.featured && <Badge>Best value</Badge>}
                </div>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                <p className="text-3xl font-semibold tracking-tight">
                  {plan.price}
                  <span className="text-base font-normal text-muted-foreground">
                    {plan.cadence}
                  </span>
                </p>
                <ul className="flex flex-col gap-2 text-sm">
                  {PLAN_FEATURES.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <Check className="size-4 shrink-0 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <form action={startCheckoutAction}>
                  <input type="hidden" name="plan" value={plan.id} />
                  <Button
                    type="submit"
                    className="w-full"
                    variant={plan.featured ? "default" : "outline"}
                  >
                    Subscribe
                  </Button>
                </form>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
