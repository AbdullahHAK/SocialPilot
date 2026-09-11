import { afterEach, describe, expect, it } from "vitest";
import { listContentPostsInRange } from "./content-post";
import { prisma } from "./index";

afterEach(async () => {
  await prisma.organization.deleteMany();
});

describe("listContentPostsInRange", () => {
  it("returns posts scheduled within the range and excludes posts outside it", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });

    const inRange = await prisma.contentPost.create({
      data: {
        organizationId: org.id,
        platform: "INSTAGRAM",
        type: "POST",
        status: "SCHEDULED",
        scheduledFor: new Date("2026-09-15T09:00:00Z"),
      },
    });
    await prisma.contentPost.create({
      data: {
        organizationId: org.id,
        platform: "FACEBOOK",
        type: "POST",
        status: "SCHEDULED",
        scheduledFor: new Date("2026-10-01T09:00:00Z"),
      },
    });

    const results = await listContentPostsInRange(
      org.id,
      new Date("2026-09-01T00:00:00Z"),
      new Date("2026-10-01T00:00:00Z"),
    );

    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe(inRange.id);
  });

  it("includes a post whose publishedAt falls in range even if scheduledFor doesn't", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });

    await prisma.contentPost.create({
      data: {
        organizationId: org.id,
        platform: "INSTAGRAM",
        type: "STORY",
        status: "PUBLISHED",
        scheduledFor: new Date("2026-08-30T09:00:00Z"),
        publishedAt: new Date("2026-09-02T09:05:00Z"),
      },
    });

    const results = await listContentPostsInRange(
      org.id,
      new Date("2026-09-01T00:00:00Z"),
      new Date("2026-10-01T00:00:00Z"),
    );

    expect(results).toHaveLength(1);
  });

  it("only returns posts for the given organization", async () => {
    const orgA = await prisma.organization.create({ data: { name: "A" } });
    const orgB = await prisma.organization.create({ data: { name: "B" } });

    await prisma.contentPost.create({
      data: {
        organizationId: orgA.id,
        platform: "INSTAGRAM",
        type: "POST",
        status: "SCHEDULED",
        scheduledFor: new Date("2026-09-15T09:00:00Z"),
      },
    });

    const results = await listContentPostsInRange(
      orgB.id,
      new Date("2026-09-01T00:00:00Z"),
      new Date("2026-10-01T00:00:00Z"),
    );

    expect(results).toHaveLength(0);
  });
});
