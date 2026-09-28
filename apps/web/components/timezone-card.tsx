"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import type { TimezoneState } from "@/app/dashboard/schedule/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatUtcOffset, TIMEZONE_VALUES } from "@/lib/timezones";

export type TimezoneAction = (
  state: TimezoneState,
  formData: FormData,
) => Promise<TimezoneState>;

export function TimezoneCard({
  action,
  initialTimezone,
}: {
  action: TimezoneAction;
  initialTimezone: string;
}) {
  const t = useTranslations("dashboard.schedule.timezoneCard");
  const tZones = useTranslations("timezones");
  const [state, formAction, isPending] = useActionState<TimezoneState, FormData>(action, {});
  // Controlled (not defaultValue) so the shown selection survives the
  // automatic client-side refresh a Server Action triggers after it
  // completes - confirmed live as a real, confusing bug otherwise: right
  // after "Saved" appeared, the dropdown would flash back to whatever it
  // showed before the change (though the save itself had gone through
  // fine), only showing the real value again on a full page reload.
  // Mirrors PublishOptionsCard's same controlled-state pattern below.
  const [timezone, setTimezone] = useState(initialTimezone);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-3">
          <div className="flex flex-1 flex-col gap-1.5">
            <Select name="timezone" value={timezone} onValueChange={setTimezone}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONE_VALUES.map((zone) => (
                  <SelectItem key={zone} value={zone}>
                    {`(${formatUtcOffset(zone)}) ${tZones(zone)}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={isPending} className="gap-2">
              {isPending && <Loader2 className="size-4 animate-spin" />}
              {t("save")}
            </Button>
            {state.saved && !isPending && (
              <p className="text-sm font-medium text-success">{t("saved")}</p>
            )}
            {state.error && !isPending && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {t("saveFailed")}
              </p>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
