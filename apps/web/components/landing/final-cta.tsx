import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/landing/reveal";

export async function FinalCta() {
  const t = await getTranslations("landing.finalCta");

  return (
    <section>
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <Reveal className="flex flex-col items-center gap-5 rounded-2xl bg-gradient-to-br from-primary to-navy px-6 py-16 text-center text-primary-foreground sm:px-16">
          <h2 className="max-w-xl text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            {t("title")}
          </h2>
          <p className="max-w-lg text-primary-foreground/80">{t("subtitle")}</p>
          <Button
            asChild
            size="lg"
            className="mt-2 h-auto min-h-11 whitespace-normal bg-gold px-8 py-3 text-base font-semibold text-gold-foreground transition-transform duration-200 hover:scale-[1.03] hover:bg-gold/90 active:scale-[0.97]"
          >
            <Link href="/pricing">{t("cta")}</Link>
          </Button>
        </Reveal>
      </div>
    </section>
  );
}
