import {
  getBrandCreativeProfile,
  getBrandProfile,
  getLastPublishedContentJob,
  getNextScheduledContentJob,
  getPublishingSchedule,
  listSocialAccounts,
} from "@socialpilot/db";
import { isBrandSetupComplete } from "@socialpilot/content-engine";
import { CalendarClock, Palette, Share2 } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PublishingStatusCard } from "@/components/publishing-status-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSession } from "@/lib/session";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const [brandProfile, creativeProfile, accounts, schedule, lastPublished, nextScheduled] =
    await Promise.all([
      getBrandProfile(session.organizationId),
      getBrandCreativeProfile(session.organizationId),
      listSocialAccounts(session.organizationId),
      getPublishingSchedule(session.organizationId),
      getLastPublishedContentJob(session.organizationId),
      getNextScheduledContentJob(session.organizationId),
    ]);

  // The one-time brand setup (logo + an approved visual style) has to
  // happen before there's anything for the automatic pipeline to work
  // from - send anyone who hasn't finished it straight there instead of
  // showing a dashboard that looks ready but won't actually publish
  // anything. This also resumes an account that only got partway through
  // (e.g. closed the tab after the logo step) right where it left off,
  // since /dashboard/create's own gate picks up whichever step is missing.
  if (!isBrandSetupComplete(brandProfile, creativeProfile)) {
    redirect("/dashboard/create");
  }

  const activeSlots = schedule.slots.filter((slot) => slot.enabled).length;

  const stats = [
    {
      href: "/dashboard/brand",
      icon: Palette,
      label: "Brand profile",
      value: brandProfile!.businessName,
      hint: "Business name, logo, and style",
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

      <PublishingStatusCard lastPublished={lastPublished} nextScheduled={nextScheduled} />

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
    </div>
  );
}
