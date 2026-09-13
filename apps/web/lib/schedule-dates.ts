import { getZonedDateParts, zonedTimeToUtc } from "./timezone";

export interface ScheduleSlotLike {
  dayOfWeek:
    | "MONDAY"
    | "TUESDAY"
    | "WEDNESDAY"
    | "THURSDAY"
    | "FRIDAY"
    | "SATURDAY"
    | "SUNDAY";
  time: string;
  platform: "INSTAGRAM" | "FACEBOOK";
}

export interface UpcomingSlotOccurrence {
  date: Date;
  platform: "INSTAGRAM" | "FACEBOOK";
}

const DAY_INDEX: Record<ScheduleSlotLike["dayOfWeek"], number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
};

/**
 * Expands enabled schedule slots into their next occurrence dates over the
 * given window, in chronological order. `time` and `dayOfWeek` are wall-
 * clock values in the org's own timezone (default UTC for orgs that
 * haven't been auto-detected yet) - each occurrence's actual UTC instant
 * is computed fresh so daylight saving shifts are handled correctly.
 */
export function computeUpcomingSlotOccurrences(
  slots: ScheduleSlotLike[],
  options: { from?: Date; days?: number; timezone?: string } = {},
): UpcomingSlotOccurrence[] {
  const from = options.from ?? new Date();
  const days = options.days ?? 30;
  const timezone = options.timezone ?? "UTC";
  const windowEnd = new Date(from.getTime() + days * 24 * 60 * 60 * 1000);

  const fromParts = getZonedDateParts(from, timezone);
  const occurrences: UpcomingSlotOccurrence[] = [];

  for (const slot of slots) {
    const [hours, minutes] = slot.time.split(":").map(Number);
    const targetDay = DAY_INDEX[slot.dayOfWeek];
    const dayDelta = (targetDay - fromParts.weekday + 7) % 7;

    // `calendarCursor` only tracks a local calendar date (year/month/day) -
    // it's a plain UTC-labeled Date used purely for day arithmetic. The
    // real UTC instant for each occurrence comes from zonedTimeToUtc.
    const calendarCursor = new Date(
      Date.UTC(fromParts.year, fromParts.month - 1, fromParts.day + dayDelta),
    );
    const occurrenceAt = () =>
      zonedTimeToUtc(
        {
          year: calendarCursor.getUTCFullYear(),
          month: calendarCursor.getUTCMonth() + 1,
          day: calendarCursor.getUTCDate(),
          hour: hours,
          minute: minutes,
        },
        timezone,
      );

    let occurrence = occurrenceAt();
    if (occurrence < from) {
      calendarCursor.setUTCDate(calendarCursor.getUTCDate() + 7);
      occurrence = occurrenceAt();
    }

    while (occurrence <= windowEnd) {
      occurrences.push({ date: occurrence, platform: slot.platform });
      calendarCursor.setUTCDate(calendarCursor.getUTCDate() + 7);
      occurrence = occurrenceAt();
    }
  }

  occurrences.sort((a, b) => a.date.getTime() - b.date.getTime());
  return occurrences;
}
