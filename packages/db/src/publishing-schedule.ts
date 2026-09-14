import type { DayOfWeek, Platform } from "@prisma/client";
import { prisma } from "./index";

export function getPublishingSchedule(organizationId: string) {
  return prisma.publishingSchedule.findUniqueOrThrow({
    where: { organizationId },
    include: { slots: { orderBy: [{ dayOfWeek: "asc" }, { time: "asc" }] } },
  });
}

export interface AddScheduleSlotInput {
  organizationId: string;
  dayOfWeek: DayOfWeek;
  time: string;
  platform: Platform;
}

export async function addScheduleSlot(input: AddScheduleSlotInput) {
  const schedule = await prisma.publishingSchedule.findUniqueOrThrow({
    where: { organizationId: input.organizationId },
  });
  return prisma.scheduleSlot.create({
    data: {
      publishingScheduleId: schedule.id,
      dayOfWeek: input.dayOfWeek,
      time: input.time,
      platform: input.platform,
    },
  });
}

export interface UpdateScheduleSlotInput {
  time?: string;
  platform?: Platform;
  enabled?: boolean;
}

export async function updateScheduleSlot(
  organizationId: string,
  slotId: string,
  data: UpdateScheduleSlotInput,
) {
  const slot = await prisma.scheduleSlot.findFirst({
    where: { id: slotId, publishingSchedule: { organizationId } },
  });
  if (!slot) return null;
  return prisma.scheduleSlot.update({ where: { id: slotId }, data });
}

/** Deliberately sets the org's timezone - for an explicit "change my
 * timezone" action, not to be called automatically from every schedule
 * action (see ensurePublishingScheduleTimezone below for why). */
export function setPublishingScheduleTimezone(organizationId: string, timezone: string) {
  return prisma.publishingSchedule.update({
    where: { organizationId },
    data: { timezone },
  });
}

/**
 * Auto-detects the org's timezone from the browser exactly once, the
 * first time anyone adds a slot or one-time post, and never touches it
 * again after that. Originally this ran unconditionally on every submit
 * (so recurring slots and one-time posts would publish at the time the
 * person actually meant, not literally that clock reading in UTC) - but
 * an organization can legitimately be used from more than one browser
 * (the agency testing alongside the client), and each one reports its
 * own OS timezone. Since the stored timezone drives which calendar day a
 * post's "already generated an image today?" check lands on, one
 * submitter's browser silently overwriting it mid-testing caused a
 * same-day image to stop being found and reused - confirmed in
 * production. Only auto-setting away from the schema default (UTC, true
 * only for a schedule nobody has ever touched) keeps the nice
 * auto-detect-on-first-use behavior while making the stored value stable
 * afterward, no matter who submits next.
 */
export async function ensurePublishingScheduleTimezone(organizationId: string, timezone: string) {
  const schedule = await prisma.publishingSchedule.findUniqueOrThrow({
    where: { organizationId },
    select: { timezone: true },
  });
  if (schedule.timezone !== "UTC") return schedule;
  return prisma.publishingSchedule.update({
    where: { organizationId },
    data: { timezone },
  });
}

export async function deleteScheduleSlot(
  organizationId: string,
  slotId: string,
): Promise<boolean> {
  const result = await prisma.scheduleSlot.deleteMany({
    where: { id: slotId, publishingSchedule: { organizationId } },
  });
  return result.count > 0;
}
