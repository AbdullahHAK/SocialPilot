"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Meridiem } from "@/lib/time-of-day";
import { cn } from "@/lib/utils";

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

export function TimeOfDayPicker({
  hour12,
  minute,
  meridiem,
  onHourChange,
  onMinuteChange,
  onMeridiemChange,
}: {
  hour12: number;
  minute: number;
  meridiem: Meridiem;
  onHourChange: (hour12: number) => void;
  onMinuteChange: (minute: number) => void;
  onMeridiemChange: (meridiem: Meridiem) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-4">
      <Select value={String(hour12)} onValueChange={(v) => onHourChange(Number(v))}>
        <SelectTrigger className="h-14 w-20 justify-center text-2xl font-semibold [&>svg]:hidden">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {HOURS.map((h) => (
            <SelectItem key={h} value={String(h)} className="justify-center text-base">
              {h}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-2xl font-semibold text-muted-foreground">:</span>
      <Select value={String(minute)} onValueChange={(v) => onMinuteChange(Number(v))}>
        <SelectTrigger className="h-14 w-20 justify-center text-2xl font-semibold [&>svg]:hidden">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MINUTES.map((m) => (
            <SelectItem key={m} value={String(m)} className="justify-center text-base">
              {String(m).padStart(2, "0")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="ml-2 flex flex-col gap-1">
        {(["AM", "PM"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onMeridiemChange(option)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
              meridiem === option
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:text-foreground",
            )}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
