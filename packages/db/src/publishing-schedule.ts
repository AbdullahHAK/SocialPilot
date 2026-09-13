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

/** Keeps the org's stored timezone in sync with what their browser
 * reports, so recurring slots and one-time posts publish at the time the
 * person actually meant, not literally that clock reading in UTC. */
export function setPublishingScheduleTimezone(organizationId: string, timezone: string) {
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
