import { describe, expect, it } from "vitest";
import { getZonedDateParts, zonedTimeToUtc } from "./timezone";

describe("zonedTimeToUtc", () => {
  it("converts a wall-clock time in a fixed-offset zone (no DST) to UTC", () => {
    // Asia/Karachi is UTC+5 year-round.
    const utc = zonedTimeToUtc(
      { year: 2026, month: 9, day: 13, hour: 10, minute: 55 },
      "Asia/Karachi",
    );
    expect(utc.toISOString()).toBe("2026-09-13T05:55:00.000Z");
  });

  it("treats UTC as a no-op", () => {
    const utc = zonedTimeToUtc({ year: 2026, month: 9, day: 13, hour: 10, minute: 55 }, "UTC");
    expect(utc.toISOString()).toBe("2026-09-13T10:55:00.000Z");
  });

  it("handles a negative offset (behind UTC)", () => {
    // America/New_York is UTC-4 in September (EDT).
    const utc = zonedTimeToUtc(
      { year: 2026, month: 9, day: 13, hour: 10, minute: 55 },
      "America/New_York",
    );
    expect(utc.toISOString()).toBe("2026-09-13T14:55:00.000Z");
  });

  it("handles the DST shift for the same zone across seasons", () => {
    // America/New_York is UTC-5 in January (EST, no DST).
    const utc = zonedTimeToUtc(
      { year: 2026, month: 1, day: 13, hour: 10, minute: 55 },
      "America/New_York",
    );
    expect(utc.toISOString()).toBe("2026-01-13T15:55:00.000Z");
  });

  it("round-trips with getZonedDateParts", () => {
    const utc = zonedTimeToUtc(
      { year: 2026, month: 9, day: 13, hour: 10, minute: 55 },
      "Asia/Karachi",
    );
    const parts = getZonedDateParts(utc, "Asia/Karachi");
    expect(parts.year).toBe(2026);
    expect(parts.month).toBe(9);
    expect(parts.day).toBe(13);
    expect(parts.hour).toBe(10);
    expect(parts.minute).toBe(55);
  });
});

describe("getZonedDateParts", () => {
  it("reports the correct weekday for a given instant in a timezone", () => {
    // 2026-09-13T05:55:00Z is a Sunday in UTC; still Sunday in Karachi (+5 -> 10:55).
    const parts = getZonedDateParts(new Date("2026-09-13T05:55:00.000Z"), "Asia/Karachi");
    expect(parts.weekday).toBe(0); // Sunday
    expect(parts.hour).toBe(10);
  });

  it("can shift the calendar day across the timezone boundary", () => {
    // Late-night UTC can already be "tomorrow" in a zone further east.
    const parts = getZonedDateParts(new Date("2026-09-13T21:00:00.000Z"), "Asia/Karachi");
    expect(parts.day).toBe(14); // 21:00 UTC + 5h = 02:00 next day in Karachi
    expect(parts.hour).toBe(2);
  });
});
