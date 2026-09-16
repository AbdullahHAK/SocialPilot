import type { Prisma } from "@prisma/client";
import { prisma } from "./index";

export interface LogAdminActionInput {
  adminId: string;
  adminEmail: string;
  /** A short machine-readable label, e.g. "customer.block" or
   * "subscription.extend" - keeps the audit log filterable/groupable. */
  action: string;
  targetType?: string;
  targetId?: string;
  details?: Prisma.InputJsonValue;
}

/** Records one admin action for accountability - the client's explicit
 * requirement. Call this from every mutating admin action, after the
 * mutation succeeds. */
export function logAdminAction(input: LogAdminActionInput) {
  return prisma.adminAuditLog.create({
    data: {
      adminId: input.adminId,
      adminEmail: input.adminEmail,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      details: input.details,
    },
  });
}

export function listRecentAuditLogEntries(limit = 100) {
  return prisma.adminAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
