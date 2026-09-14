import { afterEach, describe, expect, it } from "vitest";
import {
  addScheduleSlot,
  deleteScheduleSlot,
  ensurePublishingScheduleTimezone,
  getPublishingSchedule,
  setPublishingScheduleTimezone,
  updateScheduleSlot,
} from "./publishing-schedule";
import { prisma } from "./index";

async function createOrgWithSchedule(name: string) {
  return prisma.organization.create({
    data: { name, publishingSchedule: { create: {} } },
  });
}

afterEach(async () => {
  await prisma.organization.deleteMany();
});

describe("getPublishingSchedule", () => {
  it("returns the schedule created alongside the organization, with no slots", async () => {
    const org = await createOrgWithSchedule("Acme");
    const schedule = await getPublishingSchedule(org.id);
    expect(schedule.organizationId).toBe(org.id);
    expect(schedule.slots).toEqual([]);
  });
});

describe("addScheduleSlot", () => {
  it("adds a slot under the organization's schedule", async () => {
    const org = await createOrgWithSchedule("Acme");

    await addScheduleSlot({
      organizationId: org.id,
      dayOfWeek: "MONDAY",
      time: "09:00",
      platform: "INSTAGRAM",
    });

    const schedule = await getPublishingSchedule(org.id);
    expect(schedule.slots).toHaveLength(1);
    expect(schedule.slots[0]).toMatchObject({
      dayOfWeek: "MONDAY",
      time: "09:00",
      platform: "INSTAGRAM",
      enabled: true,
    });
  });

  it("supports multiple slots on the same day", async () => {
    const org = await createOrgWithSchedule("Acme");

    await addScheduleSlot({
      organizationId: org.id,
      dayOfWeek: "FRIDAY",
      time: "09:00",
      platform: "INSTAGRAM",
    });
    await addScheduleSlot({
      organizationId: org.id,
      dayOfWeek: "FRIDAY",
      time: "17:00",
      platform: "FACEBOOK",
    });

    const schedule = await getPublishingSchedule(org.id);
    expect(schedule.slots).toHaveLength(2);
  });
});

describe("updateScheduleSlot", () => {
  it("updates a slot belonging to the organization", async () => {
    const org = await createOrgWithSchedule("Acme");
    const slot = await addScheduleSlot({
      organizationId: org.id,
      dayOfWeek: "MONDAY",
      time: "09:00",
      platform: "INSTAGRAM",
    });

    const updated = await updateScheduleSlot(org.id, slot.id, {
      enabled: false,
    });
    expect(updated?.enabled).toBe(false);
  });

  it("returns null and does not update a slot belonging to a different organization", async () => {
    const orgA = await createOrgWithSchedule("A");
    const orgB = await createOrgWithSchedule("B");
    const slot = await addScheduleSlot({
      organizationId: orgA.id,
      dayOfWeek: "MONDAY",
      time: "09:00",
      platform: "INSTAGRAM",
    });

    const result = await updateScheduleSlot(orgB.id, slot.id, {
      enabled: false,
    });
    expect(result).toBeNull();

    const schedule = await getPublishingSchedule(orgA.id);
    expect(schedule.slots[0]?.enabled).toBe(true);
  });
});

describe("setPublishingScheduleTimezone", () => {
  it("updates the schedule's timezone", async () => {
    const org = await createOrgWithSchedule("Acme");
    expect((await getPublishingSchedule(org.id)).timezone).toBe("UTC");

    await setPublishingScheduleTimezone(org.id, "Asia/Karachi");

    expect((await getPublishingSchedule(org.id)).timezone).toBe("Asia/Karachi");
  });
});

describe("ensurePublishingScheduleTimezone", () => {
  it("sets the timezone the first time, when it's still the default", async () => {
    const org = await createOrgWithSchedule("Acme");
    expect((await getPublishingSchedule(org.id)).timezone).toBe("UTC");

    await ensurePublishingScheduleTimezone(org.id, "Africa/Casablanca");

    expect((await getPublishingSchedule(org.id)).timezone).toBe("Africa/Casablanca");
  });

  it("does not overwrite an already-established timezone", async () => {
    // Production bug: an org used from more than one browser (the agency
    // testing alongside the client) had its timezone silently clobbered
    // by whichever one submitted next, shifting which calendar day a
    // same-day image check landed on and breaking image reuse.
    const org = await createOrgWithSchedule("Acme");
    await ensurePublishingScheduleTimezone(org.id, "Africa/Casablanca");

    await ensurePublishingScheduleTimezone(org.id, "Asia/Karachi");

    expect((await getPublishingSchedule(org.id)).timezone).toBe("Africa/Casablanca");
  });
});

describe("deleteScheduleSlot", () => {
  it("deletes a slot belonging to the organization", async () => {
    const org = await createOrgWithSchedule("Acme");
    const slot = await addScheduleSlot({
      organizationId: org.id,
      dayOfWeek: "MONDAY",
      time: "09:00",
      platform: "INSTAGRAM",
    });

    const deleted = await deleteScheduleSlot(org.id, slot.id);
    expect(deleted).toBe(true);

    const schedule = await getPublishingSchedule(org.id);
    expect(schedule.slots).toHaveLength(0);
  });

  it("does not delete a slot belonging to a different organization", async () => {
    const orgA = await createOrgWithSchedule("A");
    const orgB = await createOrgWithSchedule("B");
    const slot = await addScheduleSlot({
      organizationId: orgA.id,
      dayOfWeek: "MONDAY",
      time: "09:00",
      platform: "INSTAGRAM",
    });

    const deleted = await deleteScheduleSlot(orgB.id, slot.id);
    expect(deleted).toBe(false);

    const schedule = await getPublishingSchedule(orgA.id);
    expect(schedule.slots).toHaveLength(1);
  });
});
