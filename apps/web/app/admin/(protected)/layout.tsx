import { redirect } from "next/navigation";
import { clearAdminSessionCookie, getAdminSession } from "@/lib/admin-session";
import { AdminNav } from "./admin-nav";

async function adminLogoutAction() {
  "use server";
  await clearAdminSessionCookie();
  redirect("/admin/login");
}

export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/login");
  }

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="flex w-56 shrink-0 flex-col border-e border-border bg-card">
        <div className="border-b border-border p-4">
          <p className="font-semibold">YOPAPI Admin</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{session.email}</p>
          <p className="text-xs text-muted-foreground">{session.role}</p>
        </div>
        <AdminNav />
        <form action={adminLogoutAction} className="border-t border-border p-3">
          <button type="submit" className="text-sm text-muted-foreground hover:text-destructive">
            Sign out
          </button>
        </form>
      </aside>
      <main className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
