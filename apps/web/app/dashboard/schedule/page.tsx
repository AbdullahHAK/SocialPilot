import { getPublishingSchedule } from "@socialpilot/db";
import { Plus, Trash2 } from "lucide-react";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FacebookIcon, InstagramIcon } from "@/components/icons/social";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSession } from "@/lib/session";
import {
  addScheduleSlotAction,
  removeScheduleSlotAction,
  toggleScheduleSlotAction,
} from "./actions";

const DAYS = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
] as const;

const DAY_LABELS: Record<(typeof DAYS)[number], string> = {
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

  const schedule = await getPublishingSchedule(session.organizationId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Publishing Schedule
        </h1>
        <p className="mt-1 text-muted-foreground">
          Choose which days and times SocialPilot should publish, and to
          which platform. Add as many slots per day as you need.
        </p>
      </div>

      <div className="grid gap-4">
        {DAYS.map((day) => {
          const slots = schedule.slots.filter((slot) => slot.dayOfWeek === day);

          return (
            <Card key={day}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{DAY_LABELS[day]}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {slots.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No slots — nothing will publish on this day.
                  </p>
                ) : (
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
                            <p className="font-mono text-sm font-medium">
                              {slot.time}
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
                )}

                <form
                  action={addScheduleSlotAction}
                  className="flex flex-wrap items-center gap-2"
                >
                  <input type="hidden" name="dayOfWeek" value={day} />
                  <input
                    type="time"
                    name="time"
                    required
                    className="h-9 rounded-md border border-input bg-background px-2.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <Select name="platform" defaultValue="INSTAGRAM">
                    <SelectTrigger className="h-9 w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INSTAGRAM">Instagram</SelectItem>
                      <SelectItem value="FACEBOOK">Facebook</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="submit" size="sm" variant="outline" className="gap-1.5">
                    <Plus className="size-4" />
                    Add slot
                  </Button>
                </form>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
