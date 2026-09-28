import {
  getSubscription,
  isSubscriptionActive,
  listOrganizationsForUser,
  prisma,
} from "@socialpilot/db";
import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DashboardShell } from "@/components/dashboard-shell";
import { switchOrganizationAction } from "@/app/dashboard/org-actions";
import { clearSessionCookie, getSession } from "@/lib/session";

async function logoutAction() {
  "use server";
  await clearSessionCookie();
  redirect("/login");
}

export default async function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const organization = await prisma.organization.findUnique({
    where: { id: session.organizationId },
  });

  // Re-checked on every dashboard load (not just at login) so an admin
  // action mid-session takes effect immediately, not just on next login.
  if (organization && organization.status !== "ACTIVE") {
    const t = await getTranslations("dashboard.accountStatus");
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="max-w-sm text-muted-foreground">{t("description")}</p>
        <form action={logoutAction}>
          <Button type="submit" variant="outline">
            {t("signOut")}
          </Button>
        </form>
      </div>
    );
  }

  const orgName = organization?.name ?? "YOPAPI";
  const initial = orgName.trim().charAt(0).toUpperCase() || "S";
  const [organizations, subscription] = await Promise.all([
    listOrganizationsForUser(session.userId),
    getSubscription(session.organizationId),
  ]);

  // The client's explicit, urgent fix: an account with no active
  // subscription must not be able to miss that fact - shown on every
  // dashboard page, not just Subscription, so there's no path through the
  // app where an unpaid account looks fully functional. The actual
  // blocking of paid actions (logo/content generation) is enforced
  // server-side in their own actions - this banner is the visible half of
  // that same rule, not a substitute for it.
  let banner: React.ReactNode = null;
  if (!isSubscriptionActive(subscription)) {
    const t = await getTranslations("dashboard.subscriptionGate");
    banner = (
      <div className="mb-4 flex flex-col items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2.5">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <p className="font-medium">{t("bannerMessage")}</p>
        </div>
        <Button asChild size="sm" variant="destructive" className="shrink-0">
          <Link href="/dashboard/subscription">{t("activateButton")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <DashboardShell
      orgName={orgName}
      initial={initial}
      organizations={organizations}
      currentOrgId={session.organizationId}
      switchOrgAction={switchOrganizationAction}
      logoutAction={logoutAction}
      banner={banner}
    >
      {children}
    </DashboardShell>
  );
}
