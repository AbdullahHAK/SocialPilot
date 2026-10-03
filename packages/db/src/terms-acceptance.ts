import type { Prisma } from "@prisma/client";
import { prisma } from "./index";

export interface RecordTermsAcceptanceInput {
  organizationId: string;
  version: string;
  ipAddress?: string | null;
}

/** Logs that an org's owner agreed to the Terms before paying - an
 * append-only legal record, never read back to gate app behavior. Takes an
 * optional transaction client so callers creating the org and recording its
 * acceptance in the same request (e.g. createAccountAction) can commit both
 * atomically. */
export function recordTermsAcceptance(
  input: RecordTermsAcceptanceInput,
  client: Prisma.TransactionClient | typeof prisma = prisma,
) {
  return client.termsAcceptance.create({
    data: {
      organizationId: input.organizationId,
      version: input.version,
      ipAddress: input.ipAddress ?? null,
    },
  });
}
