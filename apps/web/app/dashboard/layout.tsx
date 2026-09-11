import { prisma } from "@socialpilot/db";
import { LogOut } from "lucide-react";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DashboardNav } from "@/components/dashboard-nav";
import { Logo } from "@/components/logo";
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

  const orgName = organization?.name ?? "SocialPilot";
  const initial = orgName.trim().charAt(0).toUpperCase() || "S";

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="flex h-16 items-center border-b border-sidebar-border px-4">
          <Logo />
        </div>

        <div className="flex items-center gap-3 px-4 py-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground">
            {initial}
          </span>
          <p className="truncate text-sm font-medium">{orgName}</p>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2">
          <DashboardNav />
        </div>

        <form
          action={logoutAction}
          className="border-t border-sidebar-border p-3 pb-12"
        >
          <Button
            type="submit"
            variant="ghost"
            className="w-full justify-start gap-2.5 text-sidebar-foreground/70 hover:text-sidebar-accent-foreground"
          >
            <LogOut className="size-4" />
            Sign out
          </Button>
        </form>
      </aside>

      <main className="flex-1 overflow-y-auto p-6 sm:p-8">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
