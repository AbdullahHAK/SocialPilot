import { describe, expect, it } from "vitest";
import { formatUtcOffset, TIMEZONE_VALUES } from "./timezones";

describe("TIMEZONE_VALUES", () => {
  it("every entry is a real IANA zone Intl accepts", () => {
    for (const zone of TIMEZONE_VALUES) {
      expect(() => new Intl.DateTimeFormat(undefined, { timeZone: zone })).not.toThrow();
    }
  });

  it("has no duplicate entries", () => {
    expect(new Set(TIMEZONE_VALUES).size).toBe(TIMEZONE_VALUES.length);
  });

  it("includes GMT as Etc/UTC, not the bare 'UTC' sentinel PublishingSchedule defaults new rows to (see ensurePublishingScheduleTimezone)", () => {
    expect(TIMEZONE_VALUES).toContain("Etc/UTC");
    expect(TIMEZONE_VALUES).not.toContain("UTC");
  });
});

describe("formatUtcOffset", () => {
  it("formats a zero offset as UTC+00:00", () => {
    expect(formatUtcOffset("Etc/UTC", new Date("2026-01-15T00:00:00Z"))).toBe("UTC+00:00");
  });

  it("formats a positive whole-hour offset", () => {
    // Morocco observes a fixed +1 offset outside its short Ramadan revert.
    expect(formatUtcOffset("Africa/Casablanca", new Date("2026-01-15T00:00:00Z"))).toBe("UTC+01:00");
  });

  it("formats a negative offset", () => {
    // Mid-January - outside US daylight saving, so this is New York's
    // stable standard-time offset rather than one that shifts by season.
    expect(formatUtcOffset("America/New_York", new Date("2026-01-15T00:00:00Z"))).toBe("UTC-05:00");
  });

  it("formats a half-hour offset", () => {
    expect(formatUtcOffset("Asia/Kolkata", new Date("2026-01-15T00:00:00Z"))).toBe("UTC+05:30");
  });
});
