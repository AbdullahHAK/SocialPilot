// A curated ~40-zone shortlist (one representative city per commonly
// distinct region/offset), not the full ~400-zone IANA database - the
// client's own request was "comprehensive enough to find your region
// easily," which a full list actively works against. Ordered west to
// east by UTC offset, the same convention every mainstream timezone
// picker uses. Each value is a real IANA identifier - stored as-is on
// PublishingSchedule.timezone and fed straight to Intl/date-fns
// elsewhere, so no separate mapping layer is needed. "Etc/UTC" (not the
// bare "UTC" the schema's timezone column defaults new rows to) is used
// for GMT deliberately - see ensurePublishingScheduleTimezone in
// packages/db/src/publishing-schedule.ts: it only auto-detects a
// timezone from the browser while the stored value is still literally
// "UTC" (its default), so a user who explicitly chose GMT must be stored
// as a different string or a later visit from another browser would
// silently overwrite their deliberate choice.
export const TIMEZONE_VALUES = [
  "Pacific/Midway",
  "Pacific/Honolulu",
  "America/Anchorage",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/Mexico_City",
  "America/Bogota",
  "America/New_York",
  "America/Toronto",
  "America/Sao_Paulo",
  "America/Argentina/Buenos_Aires",
  "Atlantic/Azores",
  "Etc/UTC",
  "Europe/London",
  "Africa/Casablanca",
  "Africa/Lagos",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Rome",
  "Africa/Algiers",
  "Africa/Tunis",
  "Africa/Johannesburg",
  "Europe/Athens",
  "Africa/Cairo",
  "Europe/Istanbul",
  "Europe/Moscow",
  "Asia/Riyadh",
  "Africa/Nairobi",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Tashkent",
  "Asia/Kolkata",
  "Asia/Dhaka",
  "Asia/Bangkok",
  "Asia/Jakarta",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Pacific/Auckland",
] as const;

export type TimezoneValue = (typeof TIMEZONE_VALUES)[number];

/** "UTC+01:00" / "UTC-05:00" style offset for a zone, computed live via
 * Intl rather than hardcoded - stays correct across DST changes with no
 * maintenance, and matches whatever instant it's called at. */
export function formatUtcOffset(timeZone: string, date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    timeZoneName: "shortOffset",
  }).formatToParts(date);
  const raw = parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT";
  // Intl returns "GMT", "GMT+1", or "GMT+5:30" - normalize to a fixed-width
  // "UTC+01:00" so the list stays visually aligned regardless of zone.
  const match = raw.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!match) return "UTC+00:00";
  const [, sign, hours, minutes = "00"] = match;
  return `UTC${sign}${hours.padStart(2, "0")}:${minutes}`;
}
