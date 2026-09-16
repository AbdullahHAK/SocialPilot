import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-session";
import { AdminLoginForm } from "./login-form";

export default async function AdminLoginPage() {
  const session = await getAdminSession();
  if (session) {
    redirect("/admin/customers");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight">YOPAPI Admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Staff login - not for customers.
        </p>
        <div className="mt-6">
          <AdminLoginForm />
        </div>
      </div>
    </main>
  );
}
