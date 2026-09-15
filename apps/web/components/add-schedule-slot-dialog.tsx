"use client";

import type { DayOfWeek, Platform } from "@socialpilot/db";
import { Loader2, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
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
import { dateKey, formatMonthParam, getMonthLabels } from "@/lib/calendar";
import { to24Hour, type Meridiem } from "@/lib/time-of-day";
import { cn } from "@/lib/utils";
import type { OneTimePostResult } from "@/app/dashboard/schedule/actions";

const DAY_VALUES: DayOfWeek[] = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
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
  const t = useTranslations("dashboard.addSlotDialog");
  const tDays = useTranslations("days");
  const locale = useLocale();
  const monthLabels = getMonthLabels(locale);
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
      setError(t("pickOneDay"));
      return;
    }
    if (platforms.size === 0) {
      setError(t("pickOnePlatform"));
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
          result.reason === "not_ready" ? t("brandNotReady") : t("scheduleFailed"),
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
          {t("addPostingTime")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("dialogTitle")}</DialogTitle>
          <DialogDescription>
            {mode === "weekly" ? t("weeklyDescription") : t("onceDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
            {(
              [
                { value: "weekly", labelKey: "repeatsWeekly" },
                { value: "once", labelKey: "oneTimeDate" },
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
                {t(option.labelKey)}
              </button>
            ))}
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">{t("time")}</p>
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
              <p className="mb-2 text-sm font-medium">{t("repeatOn")}</p>
              <div className="flex justify-between gap-1.5">
                {DAY_VALUES.map((value) => {
                  const selected = days.has(value);
                  const dayName = tDays(value);
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => toggleDay(value)}
                      aria-pressed={selected}
                      title={dayName}
                      className={cn(
                        "flex size-10 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                        selected
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                      )}
                    >
                      {dayName.charAt(0)}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div>
              <p className="mb-2 text-sm font-medium">
                {t("date")} —{" "}
                <span className="font-normal text-muted-foreground">
                  {monthLabels[date.getUTCMonth()]} {date.getUTCDate()}, {date.getUTCFullYear()}
                </span>
              </p>
              <MiniDatePicker selected={date} onSelect={setDate} />
            </div>
          )}

          <div>
            <p className="mb-2 text-sm font-medium">
              {t("platform")}{" "}
              <span className="font-normal text-muted-foreground">
                {t("pickOneOrBoth")}
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
                {t("instagram")}
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
                {t("facebook")}
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
            {isPending ? t("settingUp") : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
