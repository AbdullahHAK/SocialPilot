import { listSocialAccounts } from "@socialpilot/db";
import { AlertCircle, CheckCircle2, Share2 } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FacebookIcon, InstagramIcon } from "@/components/icons/social";
import { getSession } from "@/lib/session";
import { disconnectAccountAction } from "./actions";

export default async function AccountsPage({
  searchParams,
}: PageProps<"/dashboard/accounts">) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const { error, connected } = await searchParams;
  const accounts = await listSocialAccounts(session.organizationId);
  const t = await getTranslations("dashboard.accounts");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-muted-foreground">{t("description")}</p>
        </div>
        <Button asChild>
          <a href="/api/meta/connect">{t("connect")}</a>
        </Button>
      </div>

      {typeof error === "string" && (
        <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </div>
      )}
      {typeof connected === "string" && (
        <div className="flex items-start gap-2.5 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          {t("connectedCount", { count: Number(connected) })}
        </div>
      )}

      {accounts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Share2 className="size-6" />
            </span>
            <p className="font-medium">{t("noneYetTitle")}</p>
            <p className="max-w-sm text-sm text-muted-foreground">{t("noneYetDescription")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {accounts.map((account) => (
            <Card key={account.id}>
              <CardContent className="flex items-center justify-between gap-4 p-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    {account.provider === "INSTAGRAM" ? (
                      <InstagramIcon className="size-5" />
                    ) : (
                      <FacebookIcon className="size-5" />
                    )}
                  </span>
                  <div>
                    <p className="text-sm font-medium">
                      {account.displayName ?? account.externalId}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {account.provider === "INSTAGRAM" ? t("instagram") : t("facebook")}{" "}
                      · {account.status === "ACTIVE" ? t("active") : account.status}
                    </p>
                  </div>
                </div>
                <form action={disconnectAccountAction}>
                  <input type="hidden" name="accountId" value={account.id} />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive"
                  >
                    {t("disconnect")}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
