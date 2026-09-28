"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
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
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside
        className={`fixed inset-y-0 start-0 z-50 flex w-64 shrink-0 flex-col border-e border-border bg-card transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="min-w-0">
            <p className="font-semibold">YOPAPI Admin</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{email}</p>
            <p className="text-xs text-muted-foreground">{role}</p>
          </div>
          <button
            type="button"
            className="text-muted-foreground lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <X className="size-5" />
          </button>
        </div>
        <div onClick={() => setOpen(false)}>
          <AdminNav />
        </div>
        <form action={logoutAction} className="border-t border-border p-3">
          <button type="submit" className="text-sm text-muted-foreground hover:text-destructive">
            Sign out
          </button>
        </form>
      </aside>

      {open && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4 lg:hidden">
          <p className="font-semibold">YOPAPI Admin</p>
          <button type="button" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="size-5" />
          </button>
        </div>
        <main className="flex-1 overflow-y-auto p-4 pb-20 sm:p-6 lg:pb-6">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>

      {/* The drawer above covers every case (nav + account + sign out), but
          with only two destinations, forcing a tap-to-open-drawer-then-tap
          just to switch sections is unnecessarily heavy on a phone -
          confirmed felt clunky for the client. A persistent bottom tab bar
          (the standard, thumb-reachable mobile pattern) makes switching
          between them a single tap, with no overlay to dismiss first. */}
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
