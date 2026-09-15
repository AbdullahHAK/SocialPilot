"use client";

import {
  CalendarClock,
  CalendarDays,
  CreditCard,
  LayoutDashboard,
  Palette,
  Share2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Logo generation, style approval, and "Brand Style" used to be their own
// nav items even though they're one-time setup steps, not daily-use
// tabs - that's exactly what made the app feel like a pile of disconnected
// stages instead of "just schedule it." They're still reachable (from
// Brand Settings, or automatically via the setup gate on Overview/
// Schedule) - just not permanent fixtures in the sidebar.
const NAV_ITEMS = [
  { href: "/dashboard", labelKey: "overview", icon: LayoutDashboard },
  { href: "/dashboard/schedule", labelKey: "schedule", icon: CalendarClock },
  { href: "/dashboard/calendar", labelKey: "calendar", icon: CalendarDays },
  { href: "/dashboard/accounts", labelKey: "accounts", icon: Share2 },
  { href: "/dashboard/brand", labelKey: "brand", icon: Palette },
  { href: "/dashboard/subscription", labelKey: "subscription", icon: CreditCard },
] as const;

export function DashboardNav() {
  const pathname = usePathname();
  const t = useTranslations("dashboard.nav");

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
            {t(item.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
