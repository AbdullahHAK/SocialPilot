import { CalendarClock, Clock3 } from "lucide-react";
import Link from "next/link";
import { FacebookIcon, InstagramIcon } from "@/components/icons/social";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRelativeTime } from "@/lib/relative-time";

export interface PublishingStatusCardProps {
  lastPublished: { platform: "INSTAGRAM" | "FACEBOOK"; publishedAt: Date | null } | null;
  nextScheduled: { platform: "INSTAGRAM" | "FACEBOOK"; scheduledFor: Date | null } | null;
}

export function PublishingStatusCard({
  lastPublished,
  nextScheduled,
}: PublishingStatusCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Publishing status</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Clock3 className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Last posted</p>
            {lastPublished?.publishedAt ? (
              <p className="flex items-center gap-1.5 text-sm font-medium">
                {lastPublished.platform === "INSTAGRAM" ? (
                  <InstagramIcon className="size-3.5 shrink-0" />
                ) : (
                  <FacebookIcon className="size-3.5 shrink-0" />
                )}
                {formatRelativeTime(lastPublished.publishedAt)}
              </p>
            ) : (
              <p className="text-sm font-medium text-muted-foreground">
                Nothing published yet
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CalendarClock className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Next post</p>
            {nextScheduled?.scheduledFor ? (
              <p className="flex items-center gap-1.5 text-sm font-medium">
                {nextScheduled.platform === "INSTAGRAM" ? (
                  <InstagramIcon className="size-3.5 shrink-0" />
                ) : (
                  <FacebookIcon className="size-3.5 shrink-0" />
                )}
                {formatRelativeTime(nextScheduled.scheduledFor)}
              </p>
            ) : (
              <p className="text-sm font-medium text-muted-foreground">
                Nothing scheduled —{" "}
                <Link
                  href="/dashboard/schedule"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  add a posting time
                </Link>
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
