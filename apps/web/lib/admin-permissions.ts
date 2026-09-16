import type { AdminRole } from "@socialpilot/db";

export class AdminPermissionError extends Error {
  constructor(message = "You don't have permission to do this") {
    super(message);
    this.name = "AdminPermissionError";
  }
}

/** Throws unless `role` is one of `allowed` - called at the top of every
 * sensitive admin action (delete a customer, financial subscription
 * edits). Phase 1's matrix: SUPER_ADMIN/ADMIN can do everything; SUPPORT
 * can view and do account-status actions but not delete or financial
 * edits; FINANCE is view-only until pricing/revenue features exist. */
export function requireAdminRole(role: AdminRole, allowed: AdminRole[]): void {
  if (!allowed.includes(role)) {
    throw new AdminPermissionError();
  }
}
