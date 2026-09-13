import {
  getLastPublishedPost,
  getNextScheduledPost,
  getPublishingSchedule,
} from "@socialpilot/db";
import { Trash2 } from "lucide-react";
import { redirect } from "next/navigation";
import { AddScheduleSlotDialog } from "@/components/add-schedule-slot-dialog";
import { FacebookIcon, InstagramIcon } from "@/components/icons/social";
import { PublishingStatusCard } from "@/components/publishing-status-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSession } from "@/lib/session";
import { formatTime12Hour } from "@/lib/time-of-day";
import {
  addScheduleSlotAction,
  removeScheduleSlotAction,
  toggleScheduleSlotAction,
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

const DAY_LABELS: Record<(typeof DAY_ORDER)[number], string> = {
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
  SUNDAY: "Sunday",
};

export default async function SchedulePage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const [schedule, lastPublished, nextScheduled] = await Promise.all([
    getPublishingSchedule(session.organizationId),
    getLastPublishedPost(session.organizationId),
    getNextScheduledPost(session.organizationId),
  ]);

  const slotsByDay = DAY_ORDER.map((day) => ({
    day,
    slots: schedule.slots.filter((slot) => slot.dayOfWeek === day),
  })).filter((group) => group.slots.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Publishing Schedule
          </h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Pick a time and the days it repeats on — SocialPilot generates
            and publishes the content automatically. Content for each slot
            is generated a day or two ahead of time, so adding a slot here
            doesn&apos;t create a post immediately.
          </p>
        </div>
        <AddScheduleSlotDialog action={addScheduleSlotAction} />
      </div>

      <PublishingStatusCard lastPublished={lastPublished} nextScheduled={nextScheduled} />

      {slotsByDay.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-1 py-12 text-center">
            <p className="font-medium">No posting times yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Click &quot;Add posting time&quot; above to pick a time and the
              days you want SocialPilot to publish automatically.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {slotsByDay.map(({ day, slots }) => (
            <Card key={day}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{DAY_LABELS[day]}</CardTitle>
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
                            {slot.platform === "INSTAGRAM"
                              ? "Instagram"
                              : "Facebook"}
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
                              {slot.enabled ? "Enabled" : "Disabled"}
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
                            <span className="sr-only">Remove slot</span>
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
