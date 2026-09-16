import { listOrganizations } from "@socialpilot/db";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const STATUS_BADGE_VARIANT = {
  ACTIVE: "success",
  SUSPENDED: "secondary",
  BLOCKED: "destructive",
  DELETED: "outline",
} as const;

export default async function AdminCustomersPage({
  searchParams,
}: PageProps<"/admin/customers">) {
  const { q } = await searchParams;
  const search = typeof q === "string" ? q : undefined;
  const organizations = await listOrganizations({ search });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
        <p className="mt-1 text-muted-foreground">
          {organizations.length} customer{organizations.length === 1 ? "" : "s"}
        </p>
      </div>

      <form className="max-w-sm">
        <Input name="q" placeholder="Search by name, email, or ID" defaultValue={search ?? ""} />
      </form>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/30 text-start text-xs font-medium text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 text-start">Business</th>
              <th className="px-4 py-2.5 text-start">Owner email</th>
              <th className="px-4 py-2.5 text-start">Status</th>
              <th className="px-4 py-2.5 text-start">Plan</th>
              <th className="px-4 py-2.5 text-start">Joined</th>
            </tr>
          </thead>
          <tbody>
            {organizations.map((org) => (
              <tr key={org.id} className="border-b border-border last:border-0 hover:bg-accent/30">
                <td className="px-4 py-3">
                  <Link href={`/admin/customers/${org.id}`} className="font-medium hover:underline">
                    {org.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {org.memberships[0]?.user.email ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={STATUS_BADGE_VARIANT[org.status]}>{org.status}</Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {org.subscription?.plan ?? "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {org.createdAt.toLocaleDateString()}
                </td>
              </tr>
            ))}
            {organizations.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No customers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
