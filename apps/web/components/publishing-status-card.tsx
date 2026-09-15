import { CalendarClock, Clock3 } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { FacebookIcon, InstagramIcon } from "@/components/icons/social";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRelativeTime } from "@/lib/relative-time";

export interface PublishingStatusCardProps {
  lastPublished: { platform: "INSTAGRAM" | "FACEBOOK"; publishedAt: Date | null } | null;
  nextScheduled: { platform: "INSTAGRAM" | "FACEBOOK"; scheduledFor: Date | null } | null;
}

export async function PublishingStatusCard({
  lastPublished,
  nextScheduled,
}: PublishingStatusCardProps) {
  const [locale, t] = await Promise.all([
    getLocale(),
    getTranslations("dashboard.publishingStatus"),
  ]);
  const justNow = t("justNow");
  const inAMoment = t("inAMoment");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Clock3 className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{t("lastPosted")}</p>
            {lastPublished?.publishedAt ? (
              <p className="flex items-center gap-1.5 text-sm font-medium">
                {lastPublished.platform === "INSTAGRAM" ? (
                  <InstagramIcon className="size-3.5 shrink-0" />
                ) : (
                  <FacebookIcon className="size-3.5 shrink-0" />
                )}
                {formatRelativeTime(lastPublished.publishedAt, locale, justNow, inAMoment)}
              </p>
            ) : (
              <p className="text-sm font-medium text-muted-foreground">
                {t("nothingPublishedYet")}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CalendarClock className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{t("nextPost")}</p>
            {nextScheduled?.scheduledFor ? (
              <p className="flex items-center gap-1.5 text-sm font-medium">
                {nextScheduled.platform === "INSTAGRAM" ? (
                  <InstagramIcon className="size-3.5 shrink-0" />
                ) : (
                  <FacebookIcon className="size-3.5 shrink-0" />
                )}
                {formatRelativeTime(nextScheduled.scheduledFor, locale, justNow, inAMoment)}
              </p>
            ) : (
              <p className="text-sm font-medium text-muted-foreground">
                {t("nothingScheduled")}{" "}
                <Link
                  href="/dashboard/schedule"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  {t("addPostingTime")}
                </Link>
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
