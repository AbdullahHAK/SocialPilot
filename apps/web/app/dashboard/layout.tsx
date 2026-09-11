import { prisma } from "@socialpilot/db";
import Link from "next/link";
import { redirect } from "next/navigation";
import { clearSessionCookie, getSession } from "@/lib/session";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/calendar", label: "Content Calendar" },
  { href: "/dashboard/accounts", label: "Connected Accounts" },
  { href: "/dashboard/brand", label: "Brand Settings" },
  { href: "/dashboard/schedule", label: "Publishing Schedule" },
  { href: "/dashboard/subscription", label: "Subscription" },
];

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

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-64 flex-col border-r border-gray-200 p-4">
        <p className="mb-6 font-semibold">
          {organization?.name ?? "SocialPilot"}
        </p>
        <nav className="flex flex-col gap-2">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-gray-700 hover:underline"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <form action={logoutAction} className="mt-auto pb-12 pt-8">
          <button type="submit" className="text-sm text-gray-500 underline">
            Sign out
          </button>
        </form>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
