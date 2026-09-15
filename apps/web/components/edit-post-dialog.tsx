"use client";

import { Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useState, useTransition } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { dateKey, getMonthLabels } from "@/lib/calendar";
import { from24Hour, to24Hour, type Meridiem } from "@/lib/time-of-day";
// The "./timezone" subpath (not the main @socialpilot/db barrel) keeps
// this client component's bundle free of server-only Node built-ins that
// other parts of @socialpilot/db pull in (crypto, bcrypt).
import { getZonedDateParts } from "@socialpilot/db/timezone";
import type { EditContentJobResult } from "@/app/dashboard/calendar/actions";

function initialStateFor(scheduledForIso: string) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const zoned = getZonedDateParts(new Date(scheduledForIso), timezone);
  const { hour12, minute, meridiem } = from24Hour(
    `${String(zoned.hour).padStart(2, "0")}:${String(zoned.minute).padStart(2, "0")}`,
  );
  return {
    date: new Date(Date.UTC(zoned.year, zoned.month - 1, zoned.day)),
    hour12,
    minute,
    meridiem,
  };
}

export function EditPostDialog({
  jobId,
  caption,
  scheduledForIso,
  status,
  platform,
  action,
  trigger,
}: {
  jobId: string;
  caption: string;
  scheduledForIso: string;
  status: "GENERATING" | "SCHEDULED" | "PUBLISHING" | "PUBLISHED" | "FAILED" | "RETRYING" | "CANCELLED";
  platform: "INSTAGRAM" | "FACEBOOK";
  action: (formData: FormData) => Promise<EditContentJobResult>;
  trigger: ReactNode;
}) {
  // A job that's already publishing/published/cancelled can't be
  // rescheduled - only its caption is still meaningfully editable, mirrors
  // isLocked() in calendar/actions.ts.
  const isPublished = status === "PUBLISHING" || status === "PUBLISHED" || status === "CANCELLED";
  const t = useTranslations("dashboard.editPostDialog");
  const locale = useLocale();
  const monthLabels = getMonthLabels(locale);
  const [open, setOpen] = useState(false);
  const [captionText, setCaptionText] = useState(caption);
  const [state, setState] = useState(() => initialStateFor(scheduledForIso));
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setCaptionText(caption);
    setState(initialStateFor(scheduledForIso));
    setError(null);
    setNote(null);
  }

  function handleSubmit() {
    setError(null);
    setNote(null);
    const formData = new FormData();
    formData.set("jobId", jobId);
    formData.set("caption", captionText);
    if (!isPublished) {
      formData.set("date", dateKey(state.date));
      formData.set(
        "time",
        to24Hour({ hour12: state.hour12, minute: state.minute, meridiem: state.meridiem }),
      );
      formData.set("timezone", Intl.DateTimeFormat().resolvedOptions().timeZone);
    }

    startTransition(async () => {
      const result = await action(formData);
      if (!result.ok) {
        setError(t("saveFailed"));
        return;
      }
      if (result.note) {
        // Keep the dialog open so they actually see the caveat instead of
        // it flashing by as the dialog closes.
        setNote(result.note);
        return;
      }
      setOpen(false);
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
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {isPublished ? t("descriptionPublished") : t("descriptionEditable")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <div>
            <p className="mb-2 text-sm font-medium">{t("caption")}</p>
            <Textarea
              value={captionText}
              onChange={(e) => setCaptionText(e.target.value)}
              rows={4}
              maxLength={2200}
            />
            {/* Once a save returns a note, it says the same thing more
                specifically (e.g. whether the live push actually
                succeeded) - no need to show both. */}
            {!note && isPublished && platform === "INSTAGRAM" && (
              <p className="mt-1.5 text-xs text-muted-foreground">{t("instagramCaptionLocked")}</p>
            )}
            {!note && isPublished && platform === "FACEBOOK" && (
              <p className="mt-1.5 text-xs text-muted-foreground">{t("facebookWillUpdate")}</p>
            )}
          </div>

          {!isPublished && (
            <>
              <div>
                <p className="mb-2 text-sm font-medium">{t("time")}</p>
                <TimeOfDayPicker
                  hour12={state.hour12}
                  minute={state.minute}
                  meridiem={state.meridiem}
                  onHourChange={(hour12) => setState((s) => ({ ...s, hour12 }))}
                  onMinuteChange={(minute) => setState((s) => ({ ...s, minute }))}
                  onMeridiemChange={(meridiem: Meridiem) => setState((s) => ({ ...s, meridiem }))}
                />
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">
                  {t("date")} —{" "}
                  <span className="font-normal text-muted-foreground">
                    {monthLabels[state.date.getUTCMonth()]} {state.date.getUTCDate()},{" "}
                    {state.date.getUTCFullYear()}
                  </span>
                </p>
                <MiniDatePicker
                  selected={state.date}
                  onSelect={(date) => setState((s) => ({ ...s, date }))}
                />
              </div>
            </>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
          {note && <p className="text-sm text-muted-foreground">{note}</p>}
        </div>

        <DialogFooter>
          <Button type="button" onClick={handleSubmit} disabled={isPending} className="gap-2">
            {isPending && <Loader2 className="size-4 animate-spin" />}
            {isPending ? t("saving") : t("saveChanges")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
