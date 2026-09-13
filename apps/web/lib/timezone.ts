export interface ZonedDateTimeParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
}

/** Reads the wall-clock date/time components (and weekday, 0=Sun-6=Sat)
 * that a given instant corresponds to in an IANA timezone. */
export function getZonedDateParts(
  date: Date,
  timeZone: string,
): { year: number; month: number; day: number; hour: number; minute: number; weekday: number } {
  const formatted = formatParts(date, timeZone);
  const WEEKDAY_INDEX: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    year: Number(formatted.year),
    month: Number(formatted.month),
    day: Number(formatted.day),
    hour: formatted.hour === "24" ? 0 : Number(formatted.hour),
    minute: Number(formatted.minute),
    weekday: WEEKDAY_INDEX[formatted.weekday],
  };
}

/** Converts a wall-clock date/time as experienced in the given IANA
 * timezone into the correct UTC instant, accounting for DST. Since a
 * user picking "10:55 AM" in a schedule picker means 10:55 AM where THEY
 * are, not 10:55 UTC, this is what actually makes a post go out at the
 * time someone expects. */
export function zonedTimeToUtc(parts: ZonedDateTimeParts, timeZone: string): Date {
  const naiveUtcGuess = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);

  // Ask: what wall-clock time does that guessed instant show in the
  // target timezone? The difference from our intended wall-clock time is
  // exactly the UTC offset to apply (evaluated at this specific date, so
  // DST is handled correctly rather than assuming a fixed offset).
  const shown = formatParts(new Date(naiveUtcGuess), timeZone);
  const shownAsUtc = Date.UTC(
    Number(shown.year),
    Number(shown.month) - 1,
    Number(shown.day),
    shown.hour === "24" ? 0 : Number(shown.hour),
    Number(shown.minute),
    Number(shown.second),
  );
  const offsetMs = shownAsUtc - naiveUtcGuess;

  return new Date(naiveUtcGuess - offsetMs);
}

/** The [start, end) UTC range covering one calendar day as experienced in
 * the given timezone - used to ask "has this org already generated
 * something for today (their today)?" without caring what hour it was. */
export function getLocalDayBoundsUtc(
  instant: Date,
  timeZone: string,
): { start: Date; end: Date } {
  const { year, month, day } = getZonedDateParts(instant, timeZone);
  const start = zonedTimeToUtc({ year, month, day, hour: 0, minute: 0 }, timeZone);

  const nextCalendarDay = new Date(Date.UTC(year, month - 1, day + 1));
  const end = zonedTimeToUtc(
    {
      year: nextCalendarDay.getUTCFullYear(),
      month: nextCalendarDay.getUTCMonth() + 1,
      day: nextCalendarDay.getUTCDate(),
      hour: 0,
      minute: 0,
    },
    timeZone,
  );

  return { start, end };
}

interface FormattedParts {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
  weekday: string;
}

function formatParts(date: Date, timeZone: string): FormattedParts {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
  });
  const lookup: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) {
    if (part.type !== "literal") lookup[part.type] = part.value;
  }
  return lookup as unknown as FormattedParts;
}
