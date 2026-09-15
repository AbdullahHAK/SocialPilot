import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { AiTeam } from "@/components/landing/ai-team";
import { FinalCta } from "@/components/landing/final-cta";
import { Hero } from "@/components/landing/hero";
import { PricingTeaser } from "@/components/landing/pricing-teaser";
import { StayVisible } from "@/components/landing/stay-visible";
import { ThreeMinuteSetup } from "@/components/landing/three-minute-setup";
import { VisualShowcase } from "@/components/landing/visual-showcase";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";

export default async function Home() {
  const t = await getTranslations("landing");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <nav className="flex items-center gap-1 sm:gap-2">
            <LanguageSwitcher />
            <Button asChild variant="ghost">
              <Link href="/login">{t("nav.login")}</Link>
            </Button>
            <Button asChild>
              <Link href="/pricing">{t("nav.cta")}</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <Hero />
        <AiTeam />
        <ThreeMinuteSetup />
        <VisualShowcase />
        <StayVisible />
        <PricingTeaser />
        <FinalCta />
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
          <Logo />
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} YOPAPI. {t("footer.rights")}
          </p>
          <nav className="flex gap-4 text-sm text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground hover:underline">
              {t("footer.privacy")}
            </Link>
            <Link href="/terms" className="hover:text-foreground hover:underline">
              {t("footer.terms")}
            </Link>
            <Link href="/data-deletion" className="hover:text-foreground hover:underline">
              {t("footer.dataDeletion")}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
