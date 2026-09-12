import { AlertCircle, Check, Info } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Logo } from "@/components/logo";
import { isStripeConfigured } from "@/lib/stripe";
import { startPendingCheckoutAction } from "./actions";

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

const ERROR_MESSAGES: Record<string, string> = {
  payment_incomplete: "Your payment didn't complete. Please try again.",
  missing_session: "That checkout link has expired. Please choose a plan again.",
  unknown_plan: "We couldn't match your purchase to a plan. Please try again.",
  missing_customer: "Something went wrong confirming your payment. Please try again.",
};

export default async function PricingPage({
  searchParams,
}: PageProps<"/pricing">) {
  const { checkout, error } = await searchParams;
  const billingLive = isStripeConfigured();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border/60">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <nav>
            <Button asChild variant="ghost">
              <Link href="/login">Log in</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Choose your plan
            </h1>
            <p className="mt-4 text-muted-foreground">
              Start with a plan, then connect your accounts and set up your
              brand. Cancel anytime.
            </p>
          </div>

          {!billingLive && (
            <div className="mx-auto mt-8 flex max-w-xl items-start gap-2.5 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground">
              <Info className="mt-0.5 size-4 shrink-0 text-primary" />
              Billing setup is still in progress — continue below at no
              charge for now. You&apos;ll be able to add payment details
              later from your account.
            </div>
          )}

          {checkout === "cancelled" && (
            <div className="mx-auto mt-8 flex max-w-xl items-center gap-2.5 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              Checkout was cancelled — no charges were made.
            </div>
          )}
          {typeof error === "string" && ERROR_MESSAGES[error] && (
            <div className="mx-auto mt-8 flex max-w-xl items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {ERROR_MESSAGES[error]}
            </div>
          )}

          <div className="mt-12 grid gap-6 sm:grid-cols-2">
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
                  <form action={startPendingCheckoutAction}>
                    <input type="hidden" name="plan" value={plan.id} />
                    <Button
                      type="submit"
                      className="w-full"
                      variant={plan.featured ? "default" : "outline"}
                    >
                      Choose {plan.name}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
