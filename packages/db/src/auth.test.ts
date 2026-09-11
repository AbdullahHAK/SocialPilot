import { afterEach, describe, expect, it } from "vitest";
import { authenticate, EmailAlreadyInUseError, signUp } from "./auth";
import { prisma } from "./index";

afterEach(async () => {
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();
});

describe("signUp", () => {
  it("creates a User, Organization, and OWNER Membership together", async () => {
    const result = await signUp({
      email: "owner@example.com",
      password: "hunter2hunter2",
      organizationName: "Acme Co",
      name: "Ada",
    });

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: result.userId },
      include: { memberships: true },
    });
    const organization = await prisma.organization.findUniqueOrThrow({
      where: { id: result.organizationId },
    });

    expect(user.email).toBe("owner@example.com");
    expect(user.passwordHash).not.toBe("hunter2hunter2");
    expect(organization.name).toBe("Acme Co");
    expect(user.memberships).toHaveLength(1);
    expect(user.memberships[0]?.role).toBe("OWNER");
    expect(user.memberships[0]?.organizationId).toBe(result.organizationId);
  });

  it("rejects signing up with an email that is already in use", async () => {
    await signUp({
      email: "dupe@example.com",
      password: "hunter2hunter2",
      organizationName: "First Co",
    });

    await expect(
      signUp({
        email: "dupe@example.com",
        password: "different-password",
        organizationName: "Second Co",
      }),
    ).rejects.toBeInstanceOf(EmailAlreadyInUseError);
  });
});

describe("authenticate", () => {
  it("returns the user/org ids for correct credentials", async () => {
    const signedUp = await signUp({
      email: "login@example.com",
      password: "correct-password",
      organizationName: "Login Co",
    });

    const result = await authenticate("login@example.com", "correct-password");

    expect(result).toEqual({
      userId: signedUp.userId,
      organizationId: signedUp.organizationId,
    });
  });

  it("returns null for an incorrect password", async () => {
    await signUp({
      email: "login2@example.com",
      password: "correct-password",
      organizationName: "Login Co 2",
    });

    const result = await authenticate("login2@example.com", "wrong-password");
    expect(result).toBeNull();
  });

  it("returns null for an unknown email", async () => {
    const result = await authenticate("nobody@example.com", "whatever");
    expect(result).toBeNull();
  });
});
