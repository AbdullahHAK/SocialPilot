import { AlertCircle, Check, Info } from "lucide-react";
import { getTranslations } from "next-intl/server";
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
import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo } from "@/components/logo";
import { getPlanFeatures, getPlans } from "@/lib/plans";
import { isStripeConfigured } from "@/lib/stripe";
import { startPendingCheckoutAction } from "./actions";

export default async function PricingPage({
  searchParams,
}: PageProps<"/pricing">) {
  const { checkout, error } = await searchParams;
  const billingLive = isStripeConfigured();
  const [t, tPlans] = await Promise.all([
    getTranslations("pricingPage"),
    getTranslations("plans"),
  ]);
  const plans = getPlans(tPlans);
  const features = getPlanFeatures(tPlans);
  const errorMessage = typeof error === "string" ? t.has(`errors.${error}`) ? t(`errors.${error}`) : undefined : undefined;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border/60">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <nav className="flex items-center gap-1">
            <LanguageSwitcher />
            <Button asChild variant="ghost">
              <Link href="/login">{t("login")}</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {t("title")}
            </h1>
            <p className="mt-4 text-muted-foreground">{t("subtitle")}</p>
          </div>

          {!billingLive && (
            <div className="mx-auto mt-8 flex max-w-xl items-start gap-2.5 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground">
              <Info className="mt-0.5 size-4 shrink-0 text-primary" />
              {t("billingInProgress")}
            </div>
          )}

          {checkout === "cancelled" && (
            <div className="mx-auto mt-8 flex max-w-xl items-center gap-2.5 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              {t("checkoutCancelled")}
            </div>
          )}
          {errorMessage && (
            <div className="mx-auto mt-8 flex max-w-xl items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {errorMessage}
            </div>
          )}

          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {plans.map((plan) => (
              <Card
                key={plan.id}
                className={plan.featured ? "border-primary shadow-md" : undefined}
              >
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <CardTitle>{plan.name}</CardTitle>
                    {plan.featured && <Badge>{tPlans("bestValue")}</Badge>}
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
                    {features.map((feature) => (
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
                      {t("choosePlan", { plan: plan.name })}
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
