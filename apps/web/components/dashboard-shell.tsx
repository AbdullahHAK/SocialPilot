"use client";

import { LogOut, Menu, Plus, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { DashboardNav } from "@/components/dashboard-nav";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo } from "@/components/logo";
import { isRtl, type Locale } from "@/lib/locale";
import { cn } from "@/lib/utils";

export function DashboardShell({
  orgName,
  initial,
  organizations,
  currentOrgId,
  switchOrgAction,
  logoutAction,
  children,
}: {
  orgName: string;
  initial: string;
  organizations: { id: string; name: string }[];
  currentOrgId: string;
  switchOrgAction: (formData: FormData) => void;
  logoutAction: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("dashboard.shell");
  // Computed in JS rather than via a CSS `rtl:` variant class - that would
  // leave two variant-scoped rules (rtl: and lg:) both targeting
  // transform, and which one wins depends on Tailwind's internal variant
  // ordering rather than anything explicit in this file (confirmed as a
  // real bug live: the sidebar was fully invisible on desktop under RTL).
  // A single plain class per state removes that ambiguity entirely.
  const locale = useLocale() as Locale;
  const closedTransform = isRtl(locale) ? "translate-x-full" : "-translate-x-full";

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside
        className={cn(
          "fixed inset-y-0 start-0 z-50 flex w-64 shrink-0 flex-col border-e border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-200 ease-in-out lg:static lg:translate-x-0",
          open ? "translate-x-0" : closedTransform,
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
          <Logo />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-sidebar-foreground/70 hover:text-sidebar-accent-foreground lg:hidden"
            onClick={() => setOpen(false)}
            aria-label={t("closeMenu")}
          >
            <X className="size-5" />
          </Button>
        </div>

        <div className="flex items-center justify-between gap-3 px-4 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground">
              {initial}
            </span>
            {organizations.length > 1 ? (
              <form action={switchOrgAction} className="min-w-0">
                <select
                  name="organizationId"
                  defaultValue={currentOrgId}
                  onChange={(e) => e.currentTarget.form?.requestSubmit()}
                  aria-label={t("switchBusiness")}
                  className="w-full max-w-40 truncate rounded-md border-none bg-transparent text-sm font-medium outline-none"
                >
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </form>
            ) : (
              <p className="truncate text-sm font-medium">{orgName}</p>
            )}
          </div>
          <LanguageSwitcher className="shrink-0 text-sidebar-foreground" />
        </div>

        <Link
          href="/dashboard/add-business"
          className="mx-4 mb-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <Plus className="size-3.5" />
          {t("addBusiness")}
        </Link>

        <div
          className="flex-1 overflow-y-auto px-3 py-2"
          onClick={() => setOpen(false)}
        >
          <DashboardNav />
        </div>

        <form
          action={logoutAction}
          className="border-t border-sidebar-border p-3 pb-12"
        >
          <Button
            type="submit"
            variant="ghost"
            className="w-full justify-start gap-2.5 text-sidebar-foreground/70 hover:text-sidebar-accent-foreground"
          >
            <LogOut className="size-4" />
            {t("signOut")}
          </Button>
        </form>
      </aside>

      {open && (
        <button
          type="button"
          aria-label={t("closeMenu")}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4 lg:hidden">
          <Logo />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setOpen(true)}
            aria-label={t("openMenu")}
          >
            <Menu className="size-5" />
          </Button>
        </div>

        <main className="flex-1 overflow-y-auto p-4 sm:p-8">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
