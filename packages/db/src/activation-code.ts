import { randomBytes } from "node:crypto";
import type { SubscriptionPlan } from "@prisma/client";
import { prisma } from "./index";

// Excludes visually-ambiguous characters (I/1, O/0) since these get read
// aloud or typed by hand.
const CODE_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_PREFIX = "YOPA";

function randomSegment(length: number): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CODE_CHARSET[bytes[i]! % CODE_CHARSET.length];
  }
  return out;
}

function generateCodeString(): string {
  return `${CODE_PREFIX}-${randomSegment(4)}-${randomSegment(4)}`;
}

export class ActivationCodeInvalidError extends Error {
  constructor(message = "This activation code is invalid or has already been used") {
    super(message);
    this.name = "ActivationCodeInvalidError";
  }
}

export interface GenerateActivationCodesInput {
  count: number;
  plan: SubscriptionPlan;
  durationDays: number;
  expiresAt?: Date | null;
  createdByAdminId: string;
}

/** Generates `count` unique codes in one batch insert rather than one
 * round-trip per code (matters at the 500/1000-code scale the client asked
 * for). `skipDuplicates` guards the astronomically unlikely collision
 * against a pre-existing code; the follow-up query returns exactly what
 * was actually created, so a caller never gets back a code that isn't
 * really in the database. */
export async function generateActivationCodes(
  input: GenerateActivationCodesInput,
): Promise<string[]> {
  const codes = new Set<string>();
  while (codes.size < input.count) {
    codes.add(generateCodeString());
  }
  const candidates = [...codes];

  await prisma.activationCode.createMany({
    data: candidates.map((code) => ({
      code,
      plan: input.plan,
      durationDays: input.durationDays,
      expiresAt: input.expiresAt ?? null,
      createdByAdminId: input.createdByAdminId,
    })),
    skipDuplicates: true,
  });

  const created = await prisma.activationCode.findMany({
    where: { code: { in: candidates } },
    select: { code: true },
  });
  return created.map((c) => c.code);
}

export interface RedeemActivationCodeResult {
  plan: SubscriptionPlan;
  currentPeriodEnd: Date;
}

/** Redeems a code for an organization, atomically. The UNUSED -> REDEEMED
 * transition is a compare-and-swap (same pattern as job claiming in
 * apps/worker) - under a concurrent race on the same code, only one
 * `updateMany` call actually matches a row, so a code can never grant two
 * subscriptions. Sets the org's Subscription straight to ACTIVE with no
 * Stripe ids, since this is a manual, no-payment activation. */
export async function redeemActivationCode(
  code: string,
  organizationId: string,
): Promise<RedeemActivationCodeResult> {
  return prisma.$transaction(async (tx) => {
    const record = await tx.activationCode.findUnique({ where: { code } });
    if (!record || record.status !== "UNUSED") {
      throw new ActivationCodeInvalidError();
    }
    if (record.expiresAt && record.expiresAt < new Date()) {
      throw new ActivationCodeInvalidError("This activation code has expired");
    }

    const claim = await tx.activationCode.updateMany({
      where: { id: record.id, status: "UNUSED" },
      data: { status: "REDEEMED", redeemedByOrgId: organizationId, redeemedAt: new Date() },
    });
    if (claim.count === 0) {
      throw new ActivationCodeInvalidError();
    }

    const currentPeriodEnd = new Date(
      Date.now() + record.durationDays * 24 * 60 * 60 * 1000,
    );

    await tx.subscription.upsert({
      where: { organizationId },
      create: {
        organizationId,
        plan: record.plan,
        status: "ACTIVE",
        currentPeriodEnd,
      },
      update: { plan: record.plan, status: "ACTIVE", currentPeriodEnd },
    });

    return { plan: record.plan, currentPeriodEnd };
  });
}

export function listActivationCodes(search?: string) {
  return prisma.activationCode.findMany({
    where: search ? { code: { contains: search, mode: "insensitive" } } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

/** Toggles a code between UNUSED and DISABLED only - deliberately a no-op
 * (returns false) against an already-REDEEMED code, since re-enabling one
 * back to UNUSED would let it grant a second subscription. */
export async function setActivationCodeDisabled(
  id: string,
  disabled: boolean,
): Promise<boolean> {
  const result = await prisma.activationCode.updateMany({
    where: { id, status: { in: ["UNUSED", "DISABLED"] } },
    data: { status: disabled ? "DISABLED" : "UNUSED" },
  });
  return result.count > 0;
}
