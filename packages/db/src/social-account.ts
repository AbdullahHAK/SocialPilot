import type { SocialProvider } from "@prisma/client";
import { decryptToken, encryptToken } from "./crypto";
import { prisma } from "./index";

export class SocialAccountAlreadyConnectedError extends Error {
  constructor() {
    super("This account is already connected to a different organization");
    this.name = "SocialAccountAlreadyConnectedError";
  }
}

export interface UpsertSocialAccountInput {
  organizationId: string;
  provider: SocialProvider;
  externalId: string;
  displayName?: string;
  profilePictureUrl?: string;
  accessToken: string;
  tokenExpiresAt?: Date;
}

/**
 * Creates or refreshes a connected social account. Guards against a page/IG
 * account that's already connected to a *different* organization silently
 * being reassigned to this one.
 */
export async function upsertSocialAccount(input: UpsertSocialAccountInput) {
  const existing = await prisma.socialAccount.findUnique({
    where: {
      provider_externalId: {
        provider: input.provider,
        externalId: input.externalId,
      },
    },
  });

  if (existing && existing.organizationId !== input.organizationId) {
    throw new SocialAccountAlreadyConnectedError();
  }

  const data = {
    organizationId: input.organizationId,
    provider: input.provider,
    externalId: input.externalId,
    displayName: input.displayName,
    profilePictureUrl: input.profilePictureUrl,
    accessToken: encryptToken(input.accessToken),
    tokenExpiresAt: input.tokenExpiresAt,
    status: "ACTIVE" as const,
  };

  return prisma.socialAccount.upsert({
    where: {
      provider_externalId: {
        provider: input.provider,
        externalId: input.externalId,
      },
    },
    create: data,
    update: data,
  });
}

export function listSocialAccounts(organizationId: string) {
  return prisma.socialAccount.findMany({
    where: { organizationId },
    orderBy: { createdAt: "asc" },
  });
}

export async function getDecryptedAccessToken(
  accountId: string,
): Promise<string | null> {
  const account = await prisma.socialAccount.findUnique({
    where: { id: accountId },
  });
  if (!account) return null;
  return decryptToken(account.accessToken);
}

/** Flips a connected account to EXPIRED once the worker actually hits a
 * dead token (Meta error code 190) publishing to it - surfaced on the
 * accounts page as a "reconnect" prompt. Reconnecting via the normal Meta
 * OAuth flow resets this back to ACTIVE (upsertSocialAccount always writes
 * status: "ACTIVE"). */
export function markSocialAccountExpired(accountId: string) {
  return prisma.socialAccount.update({
    where: { id: accountId },
    data: { status: "EXPIRED" },
  });
}

export async function disconnectSocialAccount(
  organizationId: string,
  accountId: string,
): Promise<boolean> {
  const result = await prisma.socialAccount.deleteMany({
    where: { id: accountId, organizationId },
  });
  return result.count > 0;
}
