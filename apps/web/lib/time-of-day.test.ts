import { describe, expect, it } from "vitest";
import { formatTime12Hour, from24Hour, to24Hour } from "./time-of-day";

describe("to24Hour", () => {
  it("converts a plain afternoon time", () => {
    expect(to24Hour({ hour12: 6, minute: 30, meridiem: "PM" })).toBe("18:30");
  });

  it("converts a plain morning time", () => {
    expect(to24Hour({ hour12: 9, minute: 5, meridiem: "AM" })).toBe("09:05");
  });

  it("handles midnight (12 AM -> 00:xx)", () => {
    expect(to24Hour({ hour12: 12, minute: 0, meridiem: "AM" })).toBe("00:00");
  });

  it("handles noon (12 PM -> 12:xx)", () => {
    expect(to24Hour({ hour12: 12, minute: 0, meridiem: "PM" })).toBe("12:00");
  });
});

describe("from24Hour", () => {
  it("reads back an afternoon time", () => {
    expect(from24Hour("18:30")).toEqual({ hour12: 6, minute: 30, meridiem: "PM" });
  });

  it("reads back a morning time", () => {
    expect(from24Hour("09:05")).toEqual({ hour12: 9, minute: 5, meridiem: "AM" });
  });

  it("reads back midnight as 12 AM", () => {
    expect(from24Hour("00:00")).toEqual({ hour12: 12, minute: 0, meridiem: "AM" });
  });

  it("reads back noon as 12 PM", () => {
    expect(from24Hour("12:00")).toEqual({ hour12: 12, minute: 0, meridiem: "PM" });
  });

  it("round-trips through to24Hour for every hour of the day", () => {
    for (let hour24 = 0; hour24 < 24; hour24++) {
      const time = `${String(hour24).padStart(2, "0")}:15`;
      expect(to24Hour(from24Hour(time))).toBe(time);
    }
  });
});

describe("formatTime12Hour", () => {
  it("formats a stored time as a human-friendly string", () => {
    expect(formatTime12Hour("18:30")).toBe("6:30 PM");
    expect(formatTime12Hour("09:05")).toBe("9:05 AM");
    expect(formatTime12Hour("00:00")).toBe("12:00 AM");
    expect(formatTime12Hour("12:00")).toBe("12:00 PM");
  });
});
