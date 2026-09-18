import { Check } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Reveal } from "@/components/landing/reveal";
import { getPlanFeatures, getPlans } from "@/lib/plans";

export async function PricingTeaser() {
  const [t, tPlans] = await Promise.all([
    getTranslations("landing.pricing"),
    getTranslations("plans"),
  ]);
  const plans = getPlans(tPlans);
  const features = getPlanFeatures(tPlans);

  return (
    <section className="border-b border-border" id="pricing">
      <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6 sm:py-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold tracking-wide text-gold uppercase">
            {t("eyebrow")}
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            {t("title")}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">{t("subtitle")}</p>
        </Reveal>

        <div className="mt-14 grid gap-6 sm:grid-cols-3">
          {plans.map((plan, index) => (
            <Reveal key={plan.id} delayMs={index * 100} className="h-full">
              <Card
                className={
                  "h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-lg " +
                  (plan.featured ? "border-gold shadow-md" : "")
                }
              >
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <CardTitle>{plan.name}</CardTitle>
                    {plan.featured && (
                      <Badge className="bg-gold text-gold-foreground">{tPlans("bestValue")}</Badge>
                    )}
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
                    {features.map((feature: string) => (
                      <li key={feature} className="flex items-center gap-2">
                        <Check className="size-4 shrink-0 text-primary" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button asChild className="w-full">
                    <Link href="/pricing">{t("cta")}</Link>
                  </Button>
                </CardContent>
              </Card>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
