import { redirect } from "next/navigation";
import { clearAdminSessionCookie, getAdminSession } from "@/lib/admin-session";
import { AdminShell } from "./admin-shell";

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
    <AdminShell email={session.email} role={session.role} logoutAction={adminLogoutAction}>
      {children}
    </AdminShell>
  );
}
