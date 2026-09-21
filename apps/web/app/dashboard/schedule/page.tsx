import {
  getBrandCreativeProfile,
  getBrandProfile,
  getLastPublishedContentJob,
  getNextScheduledContentJob,
  getPublishingSchedule,
  listSocialAccounts,
} from "@socialpilot/db";
import { isBrandSetupComplete } from "@socialpilot/content-engine";
import { Sparkles, Trash2 } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AddScheduleSlotDialog } from "@/components/add-schedule-slot-dialog";
import { FacebookIcon, InstagramIcon } from "@/components/icons/social";
import { PublishOptionsCard } from "@/components/publish-options-card";
import { PublishingStatusCard } from "@/components/publishing-status-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSession } from "@/lib/session";
import { formatTime12Hour } from "@/lib/time-of-day";
import {
  addOneTimePostAction,
  addScheduleSlotAction,
  removeScheduleSlotAction,
  toggleScheduleSlotAction,
  updatePublishOptionsAction,
} from "./actions";

const DAY_ORDER = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
] as const;

export default async function SchedulePage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const [schedule, lastPublished, nextScheduled, brandProfile, creativeProfile, socialAccounts, t, tDays] =
    await Promise.all([
      getPublishingSchedule(session.organizationId),
      getLastPublishedContentJob(session.organizationId),
      getNextScheduledContentJob(session.organizationId),
      getBrandProfile(session.organizationId),
      getBrandCreativeProfile(session.organizationId),
      listSocialAccounts(session.organizationId),
      getTranslations("dashboard.schedule"),
      getTranslations("days"),
    ]);
  const connectedPlatforms = socialAccounts
    .filter((account) => account.status === "ACTIVE")
    .map((account) => account.provider);

  if (!isBrandSetupComplete(brandProfile, creativeProfile)) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">{t("descriptionShort")}</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Sparkles className="size-6" />
            </span>
            <p className="font-medium">{t("finishBrandFirst")}</p>
            <p className="max-w-sm text-sm text-muted-foreground">{t("finishBrandFirstHint")}</p>
            <Button asChild>
              <Link href="/dashboard/create?returnTo=/dashboard/schedule">
                {t("finishSetup")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const slotsByDay = DAY_ORDER.map((day) => ({
    day,
    slots: schedule.slots.filter((slot) => slot.dayOfWeek === day),
  })).filter((group) => group.slots.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">{t("description")}</p>
        </div>
        <AddScheduleSlotDialog
          action={addScheduleSlotAction}
          onceAction={addOneTimePostAction}
          connectedPlatforms={connectedPlatforms}
        />
      </div>

      <PublishingStatusCard lastPublished={lastPublished} nextScheduled={nextScheduled} />

      <PublishOptionsCard
        action={updatePublishOptionsAction}
        initialMode={schedule.publishMode}
        initialIncludeCaption={schedule.includeCaption}
      />

      {slotsByDay.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-1 py-12 text-center">
            <p className="font-medium">{t("noPostingTimesYet")}</p>
            <p className="max-w-sm text-sm text-muted-foreground">{t("noPostingTimesHint")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {slotsByDay.map(({ day, slots }) => (
            <Card key={day}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{tDays(day)}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2">
                  {slots.map((slot) => (
                    <li
                      key={slot.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex size-8 items-center justify-center rounded-md bg-background text-muted-foreground">
                          {slot.platform === "INSTAGRAM" ? (
                            <InstagramIcon className="size-4" />
                          ) : (
                            <FacebookIcon className="size-4" />
                          )}
                        </span>
                        <div>
                          <p className="text-sm font-medium">
                            {formatTime12Hour(slot.time)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {slot.platform === "INSTAGRAM" ? t("instagram") : t("facebook")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <form action={toggleScheduleSlotAction}>
                          <input type="hidden" name="slotId" value={slot.id} />
                          <input
                            type="hidden"
                            name="enabled"
                            value={String(slot.enabled)}
                          />
                          <button type="submit">
                            <Badge
                              variant={slot.enabled ? "success" : "secondary"}
                              className="cursor-pointer"
                            >
                              {slot.enabled ? t("enabled") : t("disabled")}
                            </Badge>
                          </button>
                        </form>
                        <form action={removeScheduleSlotAction}>
                          <input type="hidden" name="slotId" value={slot.id} />
                          <Button
                            type="submit"
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="size-4" />
                            <span className="sr-only">{t("removeSlot")}</span>
                          </Button>
                        </form>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
