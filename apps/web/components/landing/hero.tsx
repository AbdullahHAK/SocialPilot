import { Sparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export async function Hero() {
  const t = await getTranslations("landing.hero");

  return (
    <section className="relative overflow-hidden bg-navy text-navy-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-40 -z-0 flex justify-center blur-3xl"
      >
        <div className="aspect-1155/678 w-[72rem] bg-gradient-to-tr from-primary/40 via-gold/10 to-transparent opacity-50" />
      </div>

      <div className="relative mx-auto flex max-w-4xl flex-col items-center gap-7 px-4 py-24 text-center sm:px-6 sm:py-32">
        <Badge className="gap-1.5 border-gold/30 bg-gold/10 px-3 py-1 text-gold">
          <Sparkles className="size-3.5" />
          {t("badge")}
        </Badge>

        <h1 className="text-4xl leading-tight font-bold tracking-tight text-balance sm:text-6xl lg:text-7xl">
          {t("headline")}
        </h1>

        <p className="max-w-2xl text-xl font-medium text-balance text-navy-foreground/90 sm:text-2xl">
          {t("subhead")}
        </p>

        <p className="max-w-xl text-base text-pretty text-navy-foreground/70">
          {t("supporting")}
        </p>

        <div className="mt-2 flex flex-col items-center gap-3 sm:flex-row">
          <Button
            asChild
            size="lg"
            className="bg-gold px-8 text-base font-semibold text-gold-foreground hover:bg-gold/90"
          >
            <Link href="/pricing">{t("cta")}</Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-navy-foreground/25 bg-transparent text-navy-foreground hover:bg-navy-foreground/10 hover:text-navy-foreground"
          >
            <Link href="/login">{t("secondaryCta")}</Link>
          </Button>
        </div>

        <p className="text-sm text-navy-foreground/60">{t("ctaSub")}</p>
      </div>
    </section>
  );
}
