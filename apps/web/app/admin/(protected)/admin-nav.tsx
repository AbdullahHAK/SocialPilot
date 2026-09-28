"use client";

import { Users, Ticket } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Shared with the mobile bottom tab bar (admin-shell.tsx) - a single list
// of destinations so the drawer's nav and the tab bar can never drift out
// of sync as sections get added.
export const ADMIN_NAV_LINKS = [
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/codes", label: "Activation Codes", icon: Ticket },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-0.5 p-3">
      {ADMIN_NAV_LINKS.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
