"use client";

import {
  CalendarClock,
  CalendarDays,
  CreditCard,
  LayoutDashboard,
  Palette,
  Share2,
  Sparkles,
  Wand2,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/create", label: "Create Content", icon: Sparkles },
  { href: "/dashboard/style", label: "Brand Style", icon: Wand2 },
  { href: "/dashboard/calendar", label: "Content Calendar", icon: CalendarDays },
  { href: "/dashboard/accounts", label: "Connected Accounts", icon: Share2 },
  { href: "/dashboard/brand", label: "Brand Settings", icon: Palette },
  { href: "/dashboard/schedule", label: "Publishing Schedule", icon: CalendarClock },
  { href: "/dashboard/subscription", label: "Subscription", icon: CreditCard },
] as const;

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const isActive =
          item.href === "/dashboard"
            ? pathname === item.href
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            <item.icon className="size-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
