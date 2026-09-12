const UNITS: Array<[string, number]> = [
  ["year", 31536000],
  ["month", 2592000],
  ["week", 604800],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
];

/** Formats a date relative to now as "3 hours ago" / "in 2 days", falling
 * back to "just now" / "in a moment" for anything under a minute. */
export function formatRelativeTime(date: Date, now: Date = new Date()): string {
  const diffSeconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const isPast = diffSeconds < 0;
  const magnitude = Math.abs(diffSeconds);

  for (const [name, secondsInUnit] of UNITS) {
    if (magnitude >= secondsInUnit) {
      const value = Math.round(magnitude / secondsInUnit);
      const unit = value === 1 ? name : `${name}s`;
      return isPast ? `${value} ${unit} ago` : `in ${value} ${unit}`;
    }
  }

  return isPast ? "just now" : "in a moment";
}
