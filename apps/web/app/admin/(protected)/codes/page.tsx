import { listActivationCodes } from "@socialpilot/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generateCodesAction, toggleCodeDisabledAction } from "./actions";

const STATUS_BADGE_VARIANT = {
  UNUSED: "secondary",
  REDEEMED: "success",
  DISABLED: "destructive",
} as const;

export default async function AdminCodesPage({
  searchParams,
}: PageProps<"/admin/codes">) {
  const { q } = await searchParams;
  const search = typeof q === "string" ? q : undefined;
  const codes = await listActivationCodes(search);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Activation Codes</h1>
        <p className="mt-1 text-muted-foreground">
          No-payment manual subscription activation.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generate codes</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={generateCodesAction} className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="count">How many</Label>
              <Input id="count" name="count" type="number" defaultValue={1} min={1} max={1000} className="w-24" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="plan">Plan</Label>
              <select id="plan" name="plan" className="h-9 rounded-md border border-input bg-background px-2 text-sm">
                <option value="MONTHLY">Monthly</option>
                <option value="SIX_MONTH">6 Months</option>
                <option value="YEARLY">Yearly</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="durationDays">Duration (days)</Label>
              <Input id="durationDays" name="durationDays" type="number" defaultValue={30} className="w-28" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="expiresAt">Code expires (optional)</Label>
              <Input id="expiresAt" name="expiresAt" type="date" className="w-40" />
            </div>
            <Button type="submit">Generate</Button>
          </form>
        </CardContent>
      </Card>

      <form className="max-w-sm">
        <Input name="q" placeholder="Search codes" defaultValue={search ?? ""} />
      </form>

      <Card className="hidden overflow-hidden sm:block">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/30 text-xs font-medium text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 text-start">Code</th>
              <th className="px-4 py-2.5 text-start">Plan</th>
              <th className="px-4 py-2.5 text-start">Duration</th>
              <th className="px-4 py-2.5 text-start">Status</th>
              <th className="px-4 py-2.5 text-start">Redeemed</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {codes.map((code) => (
              <tr key={code.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-mono">{code.code}</td>
                <td className="px-4 py-3 text-muted-foreground">{code.plan}</td>
                <td className="px-4 py-3 text-muted-foreground">{code.durationDays}d</td>
                <td className="px-4 py-3">
                  <Badge variant={STATUS_BADGE_VARIANT[code.status]}>{code.status}</Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {code.redeemedAt ? code.redeemedAt.toLocaleDateString() : "—"}
                </td>
                <td className="px-4 py-3 text-end">
                  {code.status !== "REDEEMED" && (
                    <form
                      action={toggleCodeDisabledAction.bind(
                        null,
                        code.id,
                        code.status === "UNUSED",
                      )}
                    >
                      <Button type="submit" variant="ghost" size="sm">
                        {code.status === "UNUSED" ? "Disable" : "Enable"}
                      </Button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {codes.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No codes yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <div className="flex flex-col gap-3 sm:hidden">
        {codes.map((code) => (
          <Card key={code.id} className="p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-sm font-medium">{code.code}</span>
              <Badge variant={STATUS_BADGE_VARIANT[code.status]}>{code.status}</Badge>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>{code.plan} · {code.durationDays}d</span>
              <span>
                {code.redeemedAt ? `Redeemed ${code.redeemedAt.toLocaleDateString()}` : "Unredeemed"}
              </span>
            </div>
            {code.status !== "REDEEMED" && (
              <form
                action={toggleCodeDisabledAction.bind(null, code.id, code.status === "UNUSED")}
                className="mt-2"
              >
                <Button type="submit" variant="outline" size="sm">
                  {code.status === "UNUSED" ? "Disable" : "Enable"}
                </Button>
              </form>
            )}
          </Card>
        ))}
        {codes.length === 0 && (
          <Card className="p-8 text-center text-muted-foreground">No codes yet.</Card>
        )}
      </div>
    </div>
  );
}
