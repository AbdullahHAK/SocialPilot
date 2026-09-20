import { getTranslations } from "next-intl/server";
import Link from "next/link";
import type { ReactNode } from "react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo } from "@/components/logo";
import { COMPANY_LEGAL_NAME, CONTACT_EMAIL } from "@/lib/company";

// The surrounding chrome (nav, dates, footer) is fully translated - the
// legal body text itself (passed as children by each page) deliberately
// stays in English in every locale. Auto-translating Terms of Service /
// Privacy Policy language via LLM without professional legal review is a
// real compliance risk, unlike UI chrome where a wrong word just reads
// oddly - so English is kept everywhere here rather than risk a
// mistranslated legal document being someone's binding terms.
export async function LegalPage({
  title,
  updatedDate,
  children,
}: {
  title: string;
  updatedDate: string;
  children: ReactNode;
}) {
  const [t, tFooter] = await Promise.all([
    getTranslations("legal"),
    getTranslations("landing.footer"),
  ]);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border/60">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link href="/">
            <Logo />
          </Link>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-12 sm:px-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("lastUpdated")}: {updatedDate}
          </p>
        </div>
        <div className="prose-legal flex flex-col gap-6 text-sm leading-relaxed text-foreground/90 [&_h2]:mt-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight [&_p]:text-muted-foreground [&_li]:text-muted-foreground [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5">
          {children}
        </div>
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-xs text-muted-foreground sm:px-6">
          <span>
            © {new Date().getFullYear()} YOPAPI — {COMPANY_LEGAL_NAME}.{" "}
            {tFooter("rights")}
          </span>
          <nav className="flex flex-wrap gap-4">
            <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-foreground hover:underline">
              {CONTACT_EMAIL}
            </a>
            <Link href="/privacy" className="hover:text-foreground hover:underline">
              {tFooter("privacy")}
            </Link>
            <Link href="/terms" className="hover:text-foreground hover:underline">
              {tFooter("terms")}
            </Link>
            <Link href="/data-deletion" className="hover:text-foreground hover:underline">
              {tFooter("dataDeletion")}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
