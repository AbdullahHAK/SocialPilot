import { listOrganizationsForUser, prisma } from "@socialpilot/db";
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
  const organizations = await listOrganizationsForUser(session.userId);

  return (
    <DashboardShell
      orgName={orgName}
      initial={initial}
      organizations={organizations}
      currentOrgId={session.organizationId}
      switchOrgAction={switchOrganizationAction}
      logoutAction={logoutAction}
    >
      {children}
    </DashboardShell>
  );
}
