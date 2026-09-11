import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "./index";
import {
  disconnectSocialAccount,
  getDecryptedAccessToken,
  listSocialAccounts,
  SocialAccountAlreadyConnectedError,
  upsertSocialAccount,
} from "./social-account";

// TOKEN_ENCRYPTION_KEY comes from the global test env (.env / CI workflow).

afterEach(async () => {
  await prisma.organization.deleteMany();
});

describe("upsertSocialAccount", () => {
  it("creates a new social account with the access token encrypted at rest", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });

    const account = await upsertSocialAccount({
      organizationId: org.id,
      provider: "INSTAGRAM",
      externalId: "ig-123",
      displayName: "Acme Coffee",
      accessToken: "raw-access-token",
    });

    expect(account.accessToken).not.toBe("raw-access-token");
    const stored = await prisma.socialAccount.findUniqueOrThrow({
      where: { id: account.id },
    });
    expect(stored.accessToken).not.toContain("raw-access-token");
    await expect(getDecryptedAccessToken(account.id)).resolves.toBe(
      "raw-access-token",
    );
  });

  it("refreshes the same account on reconnect instead of duplicating it", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });

    await upsertSocialAccount({
      organizationId: org.id,
      provider: "FACEBOOK",
      externalId: "page-1",
      accessToken: "token-v1",
    });
    await upsertSocialAccount({
      organizationId: org.id,
      provider: "FACEBOOK",
      externalId: "page-1",
      accessToken: "token-v2",
    });

    const accounts = await listSocialAccounts(org.id);
    expect(accounts).toHaveLength(1);
    await expect(getDecryptedAccessToken(accounts[0]!.id)).resolves.toBe(
      "token-v2",
    );
  });

  it("refuses to reassign an account already connected to a different organization", async () => {
    const orgA = await prisma.organization.create({ data: { name: "A" } });
    const orgB = await prisma.organization.create({ data: { name: "B" } });

    await upsertSocialAccount({
      organizationId: orgA.id,
      provider: "FACEBOOK",
      externalId: "shared-page",
      accessToken: "token",
    });

    await expect(
      upsertSocialAccount({
        organizationId: orgB.id,
        provider: "FACEBOOK",
        externalId: "shared-page",
        accessToken: "other-token",
      }),
    ).rejects.toBeInstanceOf(SocialAccountAlreadyConnectedError);
  });
});

describe("disconnectSocialAccount", () => {
  it("deletes an account belonging to the organization", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    const account = await upsertSocialAccount({
      organizationId: org.id,
      provider: "INSTAGRAM",
      externalId: "ig-1",
      accessToken: "token",
    });

    const deleted = await disconnectSocialAccount(org.id, account.id);
    expect(deleted).toBe(true);
    await expect(listSocialAccounts(org.id)).resolves.toHaveLength(0);
  });

  it("does not delete an account belonging to a different organization", async () => {
    const orgA = await prisma.organization.create({ data: { name: "A" } });
    const orgB = await prisma.organization.create({ data: { name: "B" } });
    const account = await upsertSocialAccount({
      organizationId: orgA.id,
      provider: "INSTAGRAM",
      externalId: "ig-1",
      accessToken: "token",
    });

    const deleted = await disconnectSocialAccount(orgB.id, account.id);
    expect(deleted).toBe(false);
    await expect(listSocialAccounts(orgA.id)).resolves.toHaveLength(1);
  });
});
