"use client";

import { LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ADMIN_NAV_LINKS, AdminNav } from "./admin-nav";

export function AdminShell({
  email,
  role,
  logoutAction,
  children,
}: {
  email: string;
  role: string;
  logoutAction: () => void;
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-muted/30">
      {/* Desktop-only - with just two destinations, mobile covers the same
          ground with the bottom tab bar below plus the sign-out icon in the
          mobile header, so a collapsible drawer duplicating both would just
          be a second, redundant path to the same places (and one more thing
          that can go wrong, as a stuck "Request Desktop Site" mode on one
          customer's phone did). */}
      <aside className="hidden w-64 shrink-0 flex-col border-e border-border bg-card lg:static lg:flex">
        <div className="border-b border-border p-4">
          <p className="font-semibold">YOPAPI Admin</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{email}</p>
          <p className="text-xs text-muted-foreground">{role}</p>
        </div>
        <AdminNav />
        <form action={logoutAction} className="border-t border-border p-3">
          <button type="submit" className="text-sm text-muted-foreground hover:text-destructive">
            Sign out
          </button>
        </form>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4 lg:hidden">
          <p className="font-semibold">YOPAPI Admin</p>
          <form action={logoutAction}>
            <button
              type="submit"
              aria-label="Sign out"
              className="text-muted-foreground hover:text-destructive"
            >
              <LogOut className="size-5" />
            </button>
          </form>
        </div>
        <main className="flex-1 overflow-y-auto p-4 pb-20 sm:p-6 lg:pb-6">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>

      {/* Persistent bottom tab bar - the standard, thumb-reachable mobile
          pattern for switching between the two sections in a single tap. */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-background lg:hidden">
        {ADMIN_NAV_LINKS.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="size-5" />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
