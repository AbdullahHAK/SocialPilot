const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 31536000],
  ["month", 2592000],
  ["week", 604800],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
];

/** Formats a date relative to now as "3 hours ago" / "in 2 days" in the
 * given locale, via the native Intl.RelativeTimeFormat (correct plural
 * rules and phrasing per language for free, instead of hand-translated
 * unit strings) - falling back to the given justNow/inAMoment strings for
 * anything under a minute, since Intl has no "just now" concept and exact
 * seconds-ago counts are noisier than this app wants. numeric: "always" is
 * deliberate - Intl's default would say "tomorrow"/"yesterday" for
 * 1-day spans, which reads inconsistently next to "in 3 hours". */
export function formatRelativeTime(
  date: Date,
  locale: string,
  justNow: string,
  inAMoment: string,
  now: Date = new Date(),
): string {
  const diffSeconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const isPast = diffSeconds < 0;
  const magnitude = Math.abs(diffSeconds);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "always" });
  for (const [unit, secondsInUnit] of UNITS) {
    if (magnitude >= secondsInUnit) {
      const value = Math.round(magnitude / secondsInUnit);
      return rtf.format(isPast ? -value : value, unit);
    }
  }

  return isPast ? justNow : inAMoment;
}
