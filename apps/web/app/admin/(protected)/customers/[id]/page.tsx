import { getMonthlyImageUsage, getNextScheduledContentJob, getOrganizationDetail } from "@socialpilot/db";
import { AlertCircle } from "lucide-react";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  adjustSubscriptionDaysAction,
  forceLogoutAction,
  manualActivateAction,
  redeemCodeForCustomerAction,
  setExpirationAction,
  setStatusAction,
  setSubscriptionStatusAction,
} from "./actions";
import { ResetAccessButton } from "./reset-access-button";

const STATUS_BADGE_VARIANT = {
  ACTIVE: "success",
  SUSPENDED: "secondary",
  BLOCKED: "destructive",
  DELETED: "outline",
} as const;

export default async function AdminCustomerDetailPage({
  params,
  searchParams,
}: PageProps<"/admin/customers/[id]">) {
  const { id } = await params;
  const { error } = await searchParams;
  const detail = await getOrganizationDetail(id);
  if (!detail) notFound();

  const { organization, publishedCount, failedCount } = detail;
  const owner = organization.memberships[0]?.user;
  const [usage, nextPost] = await Promise.all([
    getMonthlyImageUsage(id),
    getNextScheduledContentJob(id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight">{organization.name}</h1>
            <Badge variant={STATUS_BADGE_VARIANT[organization.status]}>{organization.status}</Badge>
          </div>
          <p className="mt-1 text-muted-foreground">{owner?.email ?? "No owner"}</p>
        </div>
      </div>

      {typeof error === "string" && (
        <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {organization.status !== "ACTIVE" && (
            <form action={setStatusAction.bind(null, id, "ACTIVE")}>
              <Button type="submit" size="sm">
                {organization.status === "DELETED" ? "Restore" : "Unblock/Unsuspend"}
              </Button>
            </form>
          )}
          {organization.status !== "SUSPENDED" && organization.status !== "DELETED" && (
            <form action={setStatusAction.bind(null, id, "SUSPENDED")}>
              <Button type="submit" variant="outline" size="sm">
                Suspend
              </Button>
            </form>
          )}
          {organization.status !== "BLOCKED" && organization.status !== "DELETED" && (
            <form action={setStatusAction.bind(null, id, "BLOCKED")}>
              <Button type="submit" variant="outline" size="sm">
                Block
              </Button>
            </form>
          )}
          {organization.status !== "DELETED" && (
            <form action={setStatusAction.bind(null, id, "DELETED")}>
              <Button type="submit" variant="destructive" size="sm">
                Delete
              </Button>
            </form>
          )}
          <form action={forceLogoutAction.bind(null, id)}>
            <Button type="submit" variant="outline" size="sm">
              Force logout
            </Button>
          </form>
          {owner && <ResetAccessButton organizationId={id} userId={owner.id} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Subscription</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          <div className="flex flex-wrap gap-x-8 gap-y-1 text-muted-foreground">
            <span>Plan: <strong className="text-foreground">{organization.subscription?.plan ?? "None"}</strong></span>
            <span>Status: <strong className="text-foreground">{organization.subscription?.status ?? "None"}</strong></span>
            <span>
              Expires:{" "}
              <strong className="text-foreground">
                {organization.subscription?.currentPeriodEnd?.toLocaleDateString() ?? "—"}
              </strong>
            </span>
            <span>
              Source:{" "}
              <strong className="text-foreground">
                {organization.subscription?.stripeSubscriptionId ? "Stripe" : "Manual/Code"}
              </strong>
            </span>
          </div>

          <div className="flex flex-wrap items-end gap-3 border-t border-border pt-4">
            <form action={adjustSubscriptionDaysAction} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="organizationId" value={id} />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="deltaDays">Adjust by days (+/-)</Label>
                <Input id="deltaDays" name="deltaDays" type="number" defaultValue={15} className="w-28" />
              </div>
              <Button type="submit" variant="outline" size="sm">Apply</Button>
            </form>

            <form action={setExpirationAction} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="organizationId" value={id} />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="expiration">Set exact expiration</Label>
                <Input id="expiration" name="expiration" type="date" className="w-40" />
              </div>
              <Button type="submit" variant="outline" size="sm">Set</Button>
            </form>
          </div>

          <div className="flex flex-wrap items-end gap-3 border-t border-border pt-4">
            <form action={manualActivateAction} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="organizationId" value={id} />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="plan">Manually activate - plan</Label>
                <select id="plan" name="plan" className="h-9 rounded-md border border-input bg-background px-2 text-sm">
                  <option value="MONTHLY">Monthly</option>
                  <option value="SIX_MONTH">6 Months</option>
                  <option value="YEARLY">Yearly</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="durationDays">Days</Label>
                <Input id="durationDays" name="durationDays" type="number" defaultValue={30} className="w-24" />
              </div>
              <Button type="submit" size="sm">Activate</Button>
            </form>

            <form action={redeemCodeForCustomerAction} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="organizationId" value={id} />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="code">Redeem code for this customer</Label>
                <Input id="code" name="code" placeholder="YOPA-XXXX-XXXX" className="w-40" />
              </div>
              <Button type="submit" variant="outline" size="sm">Redeem</Button>
            </form>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <form action={setSubscriptionStatusAction.bind(null, id, "PAUSED")}>
              <Button type="submit" variant="outline" size="sm">Pause</Button>
            </form>
            <form action={setSubscriptionStatusAction.bind(null, id, "CANCELED")}>
              <Button type="submit" variant="outline" size="sm">Cancel</Button>
            </form>
            <form action={setSubscriptionStatusAction.bind(null, id, "ACTIVE")}>
              <Button type="submit" size="sm">Reactivate</Button>
            </form>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Usage this month</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-x-8 gap-y-1 text-sm text-muted-foreground">
          <span>Total images: <strong className="text-foreground">{usage.total} / 40</strong></span>
          <span>Brand style revisions: <strong className="text-foreground">{usage.brandStyle} / 10</strong></span>
          <span>Logo revisions: <strong className="text-foreground">{usage.logo} / 10</strong></span>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Connected accounts</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {organization.socialAccounts.length === 0 && (
            <p className="text-muted-foreground">No accounts connected.</p>
          )}
          {organization.socialAccounts.map((account) => (
            <div key={account.id} className="flex items-center justify-between">
              <span>{account.provider} - {account.displayName ?? account.externalId}</span>
              <Badge variant={account.status === "ACTIVE" ? "success" : "destructive"}>
                {account.status}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Publishing</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-x-8 gap-y-1 text-sm text-muted-foreground">
          <span>
            Next post:{" "}
            <strong className="text-foreground">
              {nextPost?.scheduledFor ? nextPost.scheduledFor.toLocaleString() : "None scheduled"}
            </strong>
          </span>
          <span>Published: <strong className="text-foreground">{publishedCount}</strong></span>
          <span>Failed: <strong className="text-foreground">{failedCount}</strong></span>
        </CardContent>
      </Card>
    </div>
  );
}
