import { describe, expect, it } from "vitest";
import { getStartupMessage } from "./index.js";

describe("getStartupMessage", () => {
  it("returns the worker startup message", () => {
    expect(getStartupMessage()).toBe("SocialPilot worker starting up");
  });
});
