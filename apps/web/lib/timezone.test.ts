import { describe, expect, it } from "vitest";
import { getLocalDayBoundsUtc, getZonedDateParts, zonedTimeToUtc } from "./timezone";

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

describe("getLocalDayBoundsUtc", () => {
  it("spans exactly one local calendar day, in UTC terms", () => {
    // 10:55 AM Karachi time on Sept 13.
    const { start, end } = getLocalDayBoundsUtc(
      new Date("2026-09-13T05:55:00.000Z"),
      "Asia/Karachi",
    );
    expect(start.toISOString()).toBe("2026-09-12T19:00:00.000Z"); // Sept 13 00:00 Karachi
    expect(end.toISOString()).toBe("2026-09-13T19:00:00.000Z"); // Sept 14 00:00 Karachi
  });

  it("places two times on the same local day within the same bounds", () => {
    const morning = getLocalDayBoundsUtc(new Date("2026-09-13T05:00:00.000Z"), "Asia/Karachi");
    const evening = getLocalDayBoundsUtc(new Date("2026-09-13T16:00:00.000Z"), "Asia/Karachi");
    expect(morning).toEqual(evening);
  });

  it("places a time just before local midnight in the previous day's bounds", () => {
    // 11:59 PM Karachi on Sept 13 is 18:59 UTC.
    const lateNight = getLocalDayBoundsUtc(new Date("2026-09-13T18:59:00.000Z"), "Asia/Karachi");
    // Just past local midnight (00:01 AM Sept 14 Karachi = 19:01 UTC Sept 13).
    const justAfterMidnight = getLocalDayBoundsUtc(
      new Date("2026-09-13T19:01:00.000Z"),
      "Asia/Karachi",
    );
    expect(lateNight).not.toEqual(justAfterMidnight);
  });

  it("works for UTC itself", () => {
    const { start, end } = getLocalDayBoundsUtc(new Date("2026-09-13T12:00:00.000Z"), "UTC");
    expect(start.toISOString()).toBe("2026-09-13T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-09-14T00:00:00.000Z");
  });
});
