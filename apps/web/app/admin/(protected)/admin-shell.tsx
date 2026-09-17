"use client";

import { Menu, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { AdminNav } from "./admin-nav";

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
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
