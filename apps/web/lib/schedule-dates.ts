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
 * given window, in chronological order. Times are treated as UTC - this
 * powers content generation timing, not a user-facing display, so exact
 * IANA timezone conversion isn't load-bearing yet.
 */
export function computeUpcomingSlotOccurrences(
  slots: ScheduleSlotLike[],
  options: { from?: Date; days?: number } = {},
): UpcomingSlotOccurrence[] {
  const from = options.from ?? new Date();
  const days = options.days ?? 30;
  const windowEnd = new Date(from.getTime() + days * 24 * 60 * 60 * 1000);

  const occurrences: UpcomingSlotOccurrence[] = [];

  for (const slot of slots) {
    const [hours, minutes] = slot.time.split(":").map(Number);
    const targetDay = DAY_INDEX[slot.dayOfWeek];

    const cursor = new Date(
      Date.UTC(
        from.getUTCFullYear(),
        from.getUTCMonth(),
        from.getUTCDate(),
        hours,
        minutes,
        0,
        0,
      ),
    );
    const dayDelta = (targetDay - cursor.getUTCDay() + 7) % 7;
    cursor.setUTCDate(cursor.getUTCDate() + dayDelta);
    if (cursor < from) {
      cursor.setUTCDate(cursor.getUTCDate() + 7);
    }

    while (cursor <= windowEnd) {
      occurrences.push({ date: new Date(cursor), platform: slot.platform });
      cursor.setUTCDate(cursor.getUTCDate() + 7);
    }
  }

  occurrences.sort((a, b) => a.date.getTime() - b.date.getTime());
  return occurrences;
}
