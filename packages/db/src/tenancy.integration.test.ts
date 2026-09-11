import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "./index";

async function createOrg(name: string) {
  return prisma.organization.create({
    data: {
      name,
      contentPosts: {
        create: [
          { platform: "INSTAGRAM", type: "POST", status: "DRAFT" },
          { platform: "FACEBOOK", type: "STORY", status: "DRAFT" },
        ],
      },
    },
  });
}

afterEach(async () => {
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();
});

describe("multi-tenant data model", () => {
  it("scopes content posts to their owning organization", async () => {
    const orgA = await createOrg("Org A");
    const orgB = await createOrg("Org B");

    const postsForA = await prisma.contentPost.findMany({
      where: { organizationId: orgA.id },
    });
    const postsForB = await prisma.contentPost.findMany({
      where: { organizationId: orgB.id },
    });

    expect(postsForA).toHaveLength(2);
    expect(postsForB).toHaveLength(2);
    expect(postsForA.every((p) => p.organizationId === orgA.id)).toBe(true);
    expect(postsForB.every((p) => p.organizationId === orgB.id)).toBe(true);
  });

  it("cascades delete from Organization to its owned rows", async () => {
    const org = await createOrg("Org To Delete");

    await prisma.organization.delete({ where: { id: org.id } });

    const remainingPosts = await prisma.contentPost.findMany({
      where: { organizationId: org.id },
    });
    expect(remainingPosts).toHaveLength(0);
  });

  it("rejects a duplicate membership for the same user and organization", async () => {
    const user = await prisma.user.create({
      data: { email: "dup@example.com", passwordHash: "hash" },
    });
    const org = await prisma.organization.create({ data: { name: "Org" } });

    await prisma.membership.create({
      data: { userId: user.id, organizationId: org.id, role: "OWNER" },
    });

    await expect(
      prisma.membership.create({
        data: { userId: user.id, organizationId: org.id, role: "ADMIN" },
      }),
    ).rejects.toThrow();
  });

  it("rejects a duplicate user email", async () => {
    await prisma.user.create({
      data: { email: "same@example.com", passwordHash: "hash" },
    });

    await expect(
      prisma.user.create({
        data: { email: "same@example.com", passwordHash: "other-hash" },
      }),
    ).rejects.toThrow();
  });
});
