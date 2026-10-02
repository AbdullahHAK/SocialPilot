import { getSubscription, isSubscriptionActive } from "@socialpilot/db";
import { AlertCircle, Check, CheckCircle2 } from "lucide-react";
import { getTranslations } from "next-intl/server";
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
import { Input } from "@/components/ui/input";
import { PaymentTrustBar } from "@/components/payment-badges";
import { CONTACT_EMAIL, CONTACT_PHONE } from "@/lib/company";
import { getSession } from "@/lib/session";
import { getPlanFeatures, getPlans } from "@/lib/plans";
import {
  openBillingPortalAction,
  redeemActivationCodeAction,
  startCheckoutAction,
  startExtensionCheckoutAction,
} from "./actions";

export default async function SubscriptionPage({
  searchParams,
}: PageProps<"/dashboard/subscription">) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const { checkout, codeError } = await searchParams;
  const subscription = await getSubscription(session.organizationId);
  const active = isSubscriptionActive(subscription);
  const [t, tPlans] = await Promise.all([
    getTranslations("dashboard.subscription"),
    getTranslations("plans"),
  ]);
  const plans = getPlans(tPlans);
  const features = getPlanFeatures(tPlans);
  const currentPlanName = plans.find((plan) => plan.id === subscription?.plan)?.name;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-muted-foreground">{t("description")}</p>
        </div>
        <PaymentTrustBar className="sm:items-end" />
      </div>

      {checkout === "success" && (
        <div className="flex items-center gap-2.5 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          <CheckCircle2 className="size-4 shrink-0" />
          {t("confirmed")}
        </div>
      )}
      {checkout === "cancelled" && (
        <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          {t("checkoutCancelled")}
        </div>
      )}
      {subscription?.status === "PAST_DUE" && (
        <div className="flex items-center gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {t("paymentFailed")}
        </div>
      )}
      {typeof codeError === "string" && (
        <div className="flex items-center gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {t("codeInvalid")}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("redeemCodeTitle")}</CardTitle>
          <CardDescription>
            {active ? t("redeemCodeDescriptionActive") : t("redeemCodeDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={redeemActivationCodeAction} className="flex gap-2">
            <Input name="code" placeholder="YOPA-XXXX-XXXX" className="max-w-56" required />
            <Button type="submit" variant="outline">
              {t("redeemCode")}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Stripe checkout isn't fully wired up yet - the client's explicit
          temporary solution is a manual contact path so a customer isn't
          stuck with no way forward before it is. */}
      {!active && (
        <Card>
          <CardHeader>
            <CardTitle>{t("manualActivationTitle")}</CardTitle>
            <CardDescription>
              {t("manualActivationDescription", { phone: CONTACT_PHONE, email: CONTACT_EMAIL })}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {active && subscription && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>
                {currentPlanName} {t("plan")}
              </CardTitle>
              <Badge variant="success">
                {subscription.status === "TRIALING" ? t("trialing") : t("active")}
              </Badge>
            </div>
            {subscription.currentPeriodEnd && (
              <CardDescription>
                {t("renews", { date: subscription.currentPeriodEnd.toLocaleDateString() })}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <form action={openBillingPortalAction}>
              <Button type="submit" variant="outline">
                {t("manageBilling")}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {active && (
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{t("extendTitle")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("extendDescription")}</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
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
              <form action={active ? startExtensionCheckoutAction : startCheckoutAction}>
                <input type="hidden" name="plan" value={plan.id} />
                <Button
                  type="submit"
                  className="w-full"
                  variant={plan.featured ? "default" : "outline"}
                >
                  {active ? t("addTime") : t("subscribe")}
                </Button>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
