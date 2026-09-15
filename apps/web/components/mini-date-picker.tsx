"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { dateKey, getMonthGrid, getMonthLabels, getWeekdayLabels } from "@/lib/calendar";
import { cn } from "@/lib/utils";

export function MiniDatePicker({
  selected,
  onSelect,
}: {
  selected: Date;
  onSelect: (date: Date) => void;
}) {
  const t = useTranslations("dashboard.miniDatePicker");
  const locale = useLocale();
  const monthLabels = getMonthLabels(locale);
  const weekdayLabels = getWeekdayLabels(locale);
  const [viewYear, setViewYear] = useState(selected.getUTCFullYear());
  const [viewMonth, setViewMonth] = useState(selected.getUTCMonth());

  const grid = getMonthGrid(viewYear, viewMonth);
  const todayKey = dateKey(new Date());
  const selectedKey = dateKey(selected);

  function goPrevMonth() {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function goNextMonth() {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={goPrevMonth}
          className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          {/* Points toward "earlier" regardless of reading direction. */}
          <ChevronLeft className="size-4 rtl:scale-x-[-1]" />
          <span className="sr-only">{t("previousMonth")}</span>
        </button>
        <p className="text-sm font-medium">
          {monthLabels[viewMonth]} {viewYear}
        </p>
        <button
          type="button"
          onClick={goNextMonth}
          className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <ChevronRight className="size-4 rtl:scale-x-[-1]" />
          <span className="sr-only">{t("nextMonth")}</span>
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground">
        {weekdayLabels.map((label, index) => (
          <div key={index}>{label[0]}</div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {grid.map((cell) => {
          const key = dateKey(cell.date);
          const isPast = key < todayKey;
          const isSelected = key === selectedKey;
          const isToday = key === todayKey;

          return (
            <button
              key={key}
              type="button"
              disabled={isPast}
              onClick={() => onSelect(cell.date)}
              aria-pressed={isSelected}
              className={cn(
                "flex aspect-square items-center justify-center rounded-md text-xs font-medium transition-colors",
                !cell.inCurrentMonth && "text-muted-foreground/30",
                isPast && "cursor-not-allowed text-muted-foreground/20",
                !isPast &&
                  !isSelected &&
                  cell.inCurrentMonth &&
                  "hover:bg-accent hover:text-accent-foreground",
                isSelected && "bg-primary text-primary-foreground",
                !isSelected && isToday && "text-primary",
              )}
            >
              {cell.date.getUTCDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
