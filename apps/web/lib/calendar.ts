// This file is imported from client components too - the "./timezone"
// subpath is a pure, dependency-free module (no crypto/bcrypt), unlike the
// main @socialpilot/db barrel which would pull server-only Node built-ins
// into the client bundle.
import { getZonedDateParts } from "@socialpilot/db/timezone";

export interface CalendarCell {
  date: Date;
  inCurrentMonth: boolean;
}

/** Builds a 7-wide grid of dates covering the given month, padded with
 * leading/trailing days from adjacent months so every week is complete. */
export function getMonthGrid(year: number, month: number): CalendarCell[] {
  const firstOfMonth = new Date(Date.UTC(year, month, 1));
  const startWeekday = firstOfMonth.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  const cells: CalendarCell[] = [];

  for (let i = startWeekday; i > 0; i--) {
    cells.push({
      date: new Date(Date.UTC(year, month, 1 - i)),
      inCurrentMonth: false,
    });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({
      date: new Date(Date.UTC(year, month, day)),
      inCurrentMonth: true,
    });
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1]!.date;
    const next = new Date(last);
    next.setUTCDate(next.getUTCDate() + 1);
    cells.push({ date: next, inCurrentMonth: false });
  }

  return cells;
}

export function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Same YYYY-MM-DD key, but as the org's own timezone would read the
 * clock - a post scheduled at 8PM UTC for an org in Asia/Karachi (UTC+5)
 * happened just after midnight *their* next day, and needs to land in
 * that day's calendar cell, not get stranded on the UTC date. */
export function localDateKey(date: Date, timeZone: string): string {
  const { year, month, day } = getZonedDateParts(date, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseMonthParam(value: string | undefined): {
  year: number;
  month: number;
} {
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    const [yearStr, monthStr] = value.split("-");
    return { year: Number(yearStr), month: Number(monthStr) - 1 };
  }
  const now = new Date();
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() };
}

export function formatMonthParam(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

export const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
