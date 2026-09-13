export type Meridiem = "AM" | "PM";

export interface TimeOfDay {
  hour12: number;
  minute: number;
  meridiem: Meridiem;
}

/** Converts a 12-hour clock reading (hour 1-12, AM/PM) into the "HH:MM"
 * 24-hour string the backend stores and validates. */
export function to24Hour({ hour12, minute, meridiem }: TimeOfDay): string {
  const hour24 = (hour12 % 12) + (meridiem === "PM" ? 12 : 0);
  return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** The inverse of to24Hour - reads a stored "HH:MM" string back out as a
 * 12-hour clock reading, for display and for pre-filling the picker. */
export function from24Hour(time: string): TimeOfDay {
  const [hourStr, minuteStr] = time.split(":");
  const hour24 = Number(hourStr);
  const minute = Number(minuteStr);
  const meridiem: Meridiem = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return { hour12, minute, meridiem };
}

/** Formats a stored "HH:MM" string as a human-friendly "6:30 PM". */
export function formatTime12Hour(time: string): string {
  const { hour12, minute, meridiem } = from24Hour(time);
  return `${hour12}:${String(minute).padStart(2, "0")} ${meridiem}`;
}
