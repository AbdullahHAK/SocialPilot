"use client";

import type { DayOfWeek, Platform } from "@socialpilot/db";
import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FacebookIcon, InstagramIcon } from "@/components/icons/social";
import { MiniDatePicker } from "@/components/mini-date-picker";
import { TimeOfDayPicker } from "@/components/time-of-day-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { dateKey, formatMonthParam, MONTH_LABELS } from "@/lib/calendar";
import { to24Hour, type Meridiem } from "@/lib/time-of-day";
import { cn } from "@/lib/utils";
import type { OneTimePostResult } from "@/app/dashboard/schedule/actions";

const DAY_OPTIONS: { value: DayOfWeek; label: string }[] = [
  { value: "SUNDAY", label: "S" },
  { value: "MONDAY", label: "M" },
  { value: "TUESDAY", label: "T" },
  { value: "WEDNESDAY", label: "W" },
  { value: "THURSDAY", label: "T" },
  { value: "FRIDAY", label: "F" },
  { value: "SATURDAY", label: "S" },
];

type Mode = "weekly" | "once";

function todayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function AddScheduleSlotDialog({
  action,
  onceAction,
}: {
  action: (formData: FormData) => void | Promise<void>;
  onceAction: (formData: FormData) => Promise<OneTimePostResult>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("weekly");
  const [days, setDays] = useState<Set<DayOfWeek>>(new Set());
  const [date, setDate] = useState<Date>(todayUTC);
  const [hour12, setHour12] = useState(6);
  const [minute, setMinute] = useState(0);
  const [meridiem, setMeridiem] = useState<Meridiem>("PM");
  const [platforms, setPlatforms] = useState<Set<Platform>>(new Set(["INSTAGRAM"]));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggleDay(day: DayOfWeek) {
    setDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }

  function togglePlatform(platform: Platform) {
    setPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(platform)) next.delete(platform);
      else next.add(platform);
      return next;
    });
  }

  function reset() {
    setMode("weekly");
    setDays(new Set());
    setDate(todayUTC());
    setHour12(6);
    setMinute(0);
    setMeridiem("PM");
    setPlatforms(new Set(["INSTAGRAM"]));
    setError(null);
  }

  function handleSubmit() {
    if (mode === "weekly" && days.size === 0) {
      setError("Pick at least one day.");
      return;
    }
    if (platforms.size === 0) {
      setError("Pick at least one platform.");
      return;
    }
    setError(null);

    const time = to24Hour({ hour12, minute, meridiem });
    // Read fresh at submit time rather than caching in state - this is
    // what makes a picked "10:55 AM" mean 10:55 where the person actually
    // is, instead of literally 10:55 UTC.
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    if (mode === "weekly") {
      const formData = new FormData();
      for (const day of days) formData.append("dayOfWeek", day);
      for (const platform of platforms) formData.append("platform", platform);
      formData.set("time", time);
      formData.set("timezone", timezone);

      startTransition(async () => {
        await action(formData);
        setOpen(false);
        reset();
      });
      return;
    }

    const formData = new FormData();
    for (const platform of platforms) formData.append("platform", platform);
    formData.set("date", dateKey(date));
    formData.set("time", time);
    formData.set("timezone", timezone);

    startTransition(async () => {
      const result = await onceAction(formData);
      if (!result.ok) {
        setError(
          result.reason === "not_ready"
            ? "Set up your brand style and logo first (see the Logo and Brand Style pages) before scheduling a one-time post."
            : "Couldn't schedule that post. Please try again.",
        );
        return;
      }
      setOpen(false);
      reset();
      const monthParam = formatMonthParam(date.getUTCFullYear(), date.getUTCMonth());
      router.push(`/dashboard/calendar?month=${monthParam}`);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isPending) return;
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="lg" className="gap-2">
          <Plus className="size-4" />
          Add posting time
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a posting time</DialogTitle>
          <DialogDescription>
            {mode === "weekly"
              ? "Pick a time, choose which days it repeats on, and YOPAPI handles the rest."
              : "Pick a time and a specific date for a one-time post — it'll show up on your Content Calendar."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
            {(
              [
                { value: "weekly", label: "Repeats weekly" },
                { value: "once", label: "One-time date" },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setMode(option.value)}
                aria-pressed={mode === option.value}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  mode === option.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Time</p>
            <TimeOfDayPicker
              hour12={hour12}
              minute={minute}
              meridiem={meridiem}
              onHourChange={setHour12}
              onMinuteChange={setMinute}
              onMeridiemChange={setMeridiem}
            />
          </div>

          {mode === "weekly" ? (
            <div>
              <p className="mb-2 text-sm font-medium">Repeat on</p>
              <div className="flex justify-between gap-1.5">
                {DAY_OPTIONS.map(({ value, label }) => {
                  const selected = days.has(value);
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => toggleDay(value)}
                      aria-pressed={selected}
                      title={value.charAt(0) + value.slice(1).toLowerCase()}
                      className={cn(
                        "flex size-10 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                        selected
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div>
              <p className="mb-2 text-sm font-medium">
                Date —{" "}
                <span className="font-normal text-muted-foreground">
                  {MONTH_LABELS[date.getUTCMonth()]} {date.getUTCDate()}, {date.getUTCFullYear()}
                </span>
              </p>
              <MiniDatePicker selected={date} onSelect={setDate} />
            </div>
          )}

          <div>
            <p className="mb-2 text-sm font-medium">
              Platform{" "}
              <span className="font-normal text-muted-foreground">
                (pick one or both)
              </span>
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => togglePlatform("INSTAGRAM")}
                aria-pressed={platforms.has("INSTAGRAM")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                  platforms.has("INSTAGRAM")
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-input text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <InstagramIcon className="size-4" />
                Instagram
              </button>
              <button
                type="button"
                onClick={() => togglePlatform("FACEBOOK")}
                aria-pressed={platforms.has("FACEBOOK")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                  platforms.has("FACEBOOK")
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-input text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <FacebookIcon className="size-4" />
                Facebook
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="gap-2"
          >
            {isPending && <Loader2 className="size-4 animate-spin" />}
            {isPending ? "Setting up your post…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
