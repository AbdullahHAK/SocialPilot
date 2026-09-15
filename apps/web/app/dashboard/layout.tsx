import { prisma } from "@socialpilot/db";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
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

  const orgName = organization?.name ?? "YOPAPI";
  const initial = orgName.trim().charAt(0).toUpperCase() || "S";

  return (
    <DashboardShell orgName={orgName} initial={initial} logoutAction={logoutAction}>
      {children}
    </DashboardShell>
  );
}
