import {
  getBrandProfile,
  getPublishingSchedule,
  listSocialAccounts,
} from "@socialpilot/db";
import { CalendarClock, Palette, Share2 } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSession } from "@/lib/session";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const [brandProfile, accounts, schedule] = await Promise.all([
    getBrandProfile(session.organizationId),
    listSocialAccounts(session.organizationId),
    getPublishingSchedule(session.organizationId),
  ]);

  const activeSlots = schedule.slots.filter((slot) => slot.enabled).length;

  const stats = [
    {
      href: "/dashboard/brand",
      icon: Palette,
      label: "Brand profile",
      value: brandProfile ? brandProfile.businessName : "Not set up",
      hint: brandProfile ? "Set up" : "Complete onboarding to set this up",
    },
    {
      href: "/dashboard/accounts",
      icon: Share2,
      label: "Connected accounts",
      value: String(accounts.length),
      hint: accounts.length === 0 ? "Connect Instagram or Facebook" : "Ready to publish",
    },
    {
      href: "/dashboard/schedule",
      icon: CalendarClock,
      label: "Active publishing slots",
      value: String(activeSlots),
      hint: activeSlots === 0 ? "Add slots to start publishing" : "Per week",
    },
  ] as const;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="mt-1 text-muted-foreground">
          Here&apos;s the current state of your SocialPilot setup.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <Link key={stat.href} href={stat.href}>
            <Card className="h-full transition-colors hover:border-primary/40 hover:bg-accent/30">
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
                <stat.icon className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="truncate text-2xl font-semibold">{stat.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{stat.hint}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Content Calendar</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Your content calendar and publishing activity will appear here
            once the automated content pipeline is live.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
