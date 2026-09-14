import { getPublishingSchedule, listContentJobsInRange } from "@socialpilot/db";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FacebookIcon, InstagramIcon } from "@/components/icons/social";
import {
  PostHoverCard,
  STATUS_BADGE_VARIANT,
  type CalendarPost,
  type CalendarPostStatus,
} from "@/components/post-hover-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  dateKey,
  formatMonthParam,
  getMonthGrid,
  localDateKey,
  MONTH_LABELS,
  parseMonthParam,
  WEEKDAY_LABELS,
} from "@/lib/calendar";
import { getSession } from "@/lib/session";
import { deleteContentJobPlatformAction, editContentJobAction } from "./actions";

/** A card's status combines the shared job's state (has a creative been
 * generated yet? was it cancelled?) with this specific platform's own
 * publish state - two platforms on the same job can show different
 * statuses (e.g. Instagram PUBLISHED, Facebook RETRYING) even though they
 * share one creative. */
function displayStatus(
  jobStatus: string,
  publicationStatus: string,
): CalendarPostStatus {
  if (jobStatus === "CANCELLED") return "CANCELLED";
  if (publicationStatus !== "PENDING") return publicationStatus as CalendarPostStatus;
  if (jobStatus === "PENDING" || jobStatus === "GENERATING") return "GENERATING";
  return "SCHEDULED"; // job's creative is READY (or job is PUBLISHING), this platform hasn't been attempted yet
}

export default async function CalendarPage({
  searchParams,
}: PageProps<"/dashboard/calendar">) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const { month: monthParam } = await searchParams;
  const { year, month } = parseMonthParam(
    typeof monthParam === "string" ? monthParam : undefined,
  );

  const rangeStart = new Date(Date.UTC(year, month, 1));
  const rangeEnd = new Date(Date.UTC(year, month + 1, 1));
  const [jobs, schedule] = await Promise.all([
    listContentJobsInRange(session.organizationId, rangeStart, rangeEnd),
    getPublishingSchedule(session.organizationId),
  ]);

  // One card per (job, platform), matching the pre-existing UX of one card
  // per platform - a job spanning both platforms still shows two cards,
  // just always sharing the same creative now.
  const posts: CalendarPost[] = jobs.flatMap((job) =>
    job.publications.map((publication) => ({
      jobId: job.id,
      platform: publication.platform,
      status: displayStatus(job.status, publication.status),
      caption: job.caption,
      imageUrls: job.masterImageUrl ? [job.masterImageUrl] : [],
      scheduledFor: (publication.publishedAt ?? job.scheduledFor).toISOString(),
    })),
  );

  // Grouped by the org's own local calendar day, not UTC - a post
  // scheduled late in the UTC day can already be "tomorrow" where the
  // org actually is, and needs to land in that day's cell.
  const postsByDay = new Map<string, CalendarPost[]>();
  for (const post of posts) {
    const key = localDateKey(new Date(post.scheduledFor), schedule.timezone);
    const existing = postsByDay.get(key) ?? [];
    existing.push(post);
    postsByDay.set(key, existing);
  }

  const grid = getMonthGrid(year, month);
  const prevMonth = month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 };
  const nextMonth = month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 };
  const todayKey = localDateKey(new Date(), schedule.timezone);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Content Calendar
          </h1>
          <p className="mt-1 text-muted-foreground">
            Scheduled and published posts, at a glance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="icon">
            <Link href={`?month=${formatMonthParam(prevMonth.year, prevMonth.month)}`}>
              <ChevronLeft className="size-4" />
              <span className="sr-only">Previous month</span>
            </Link>
          </Button>
          <p className="w-40 text-center text-sm font-medium">
            {MONTH_LABELS[month]} {year}
          </p>
          <Button asChild variant="outline" size="icon">
            <Link href={`?month=${formatMonthParam(nextMonth.year, nextMonth.month)}`}>
              <ChevronRight className="size-4" />
              <span className="sr-only">Next month</span>
            </Link>
          </Button>
        </div>
      </div>

      {posts.length === 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
          Nothing here yet — this fills in automatically once the AI content
          pipeline starts generating and publishing on your schedule.
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border bg-muted/30">
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              className="px-2 py-2 text-center text-xs font-medium text-muted-foreground"
            >
              {label}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {grid.map((cell) => {
            const key = dateKey(cell.date);
            const dayPosts = postsByDay.get(key) ?? [];
            const isToday = key === todayKey;

            return (
              <div
                key={key}
                className="flex min-h-28 flex-col gap-1.5 border-b border-r border-border p-2 last:border-r-0 [&:nth-child(7n)]:border-r-0"
              >
                <span
                  className={
                    isToday
                      ? "flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
                      : cell.inCurrentMonth
                        ? "text-xs font-medium"
                        : "text-xs font-medium text-muted-foreground/40"
                  }
                >
                  {cell.date.getUTCDate()}
                </span>
                <div className="flex flex-col gap-1">
                  {dayPosts.map((post) => (
                    <PostHoverCard
                      key={`${post.jobId}-${post.platform}`}
                      post={post}
                      editAction={editContentJobAction}
                      deleteAction={deleteContentJobPlatformAction}
                    >
                      <button
                        type="button"
                        className="flex w-full cursor-default items-center justify-center gap-1 rounded-md bg-accent/60 px-1.5 py-1 text-[11px] font-medium transition-colors hover:bg-accent sm:justify-start"
                      >
                        {post.platform === "INSTAGRAM" ? (
                          <InstagramIcon className="size-3 shrink-0" />
                        ) : (
                          <FacebookIcon className="size-3 shrink-0" />
                        )}
                        {/* Below `sm`, cells are only ~35px wide - a couple
                            of truncated letters read as broken, not
                            helpful, so just show the platform icon and
                            rely on the hover card for detail. */}
                        <span className="hidden min-w-0 truncate sm:inline">
                          {post.caption || post.status}
                        </span>
                      </button>
                    </PostHoverCard>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {posts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {(Object.keys(STATUS_BADGE_VARIANT) as Array<keyof typeof STATUS_BADGE_VARIANT>).map(
            (status) => (
              <Badge key={status} variant={STATUS_BADGE_VARIANT[status]}>
                {status}
              </Badge>
            ),
          )}
        </div>
      )}
    </div>
  );
}
