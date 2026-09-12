import { afterEach, describe, expect, it } from "vitest";
import {
  createContentPost,
  getLastPublishedPost,
  getNextScheduledPost,
  listContentPostsInRange,
  listDuePosts,
  markContentPostFailed,
  markContentPostPublished,
} from "./content-post";
import { prisma } from "./index";

afterEach(async () => {
  await prisma.organization.deleteMany();
});

describe("createContentPost", () => {
  it("creates a SCHEDULED post with the given fields", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });

    const post = await createContentPost({
      organizationId: org.id,
      platform: "INSTAGRAM",
      caption: "New arrivals!",
      hashtags: ["#new", "#sale"],
      imageUrls: ["https://example.com/a.png"],
      scheduledFor: new Date("2026-09-20T09:00:00Z"),
    });

    expect(post.status).toBe("SCHEDULED");
    expect(post.type).toBe("POST");
    expect(post.caption).toBe("New arrivals!");
    expect(post.hashtags).toEqual(["#new", "#sale"]);
  });
});

describe("listDuePosts", () => {
  it("returns only SCHEDULED posts at or before the given time, with the account preloaded", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    await prisma.socialAccount.create({
      data: {
        organizationId: org.id,
        provider: "INSTAGRAM",
        externalId: "ig_1",
        accessToken: "enc",
      },
    });

    const due = await createContentPost({
      organizationId: org.id,
      platform: "INSTAGRAM",
      imageUrls: ["https://example.com/a.png"],
      scheduledFor: new Date("2026-09-01T00:00:00Z"),
    });
    await createContentPost({
      organizationId: org.id,
      platform: "INSTAGRAM",
      imageUrls: ["https://example.com/b.png"],
      scheduledFor: new Date("2099-01-01T00:00:00Z"),
    });

    const results = await listDuePosts(new Date("2026-09-15T00:00:00Z"));

    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe(due.id);
    expect(results[0]?.organization.socialAccounts).toHaveLength(1);
  });
});

describe("markContentPostPublished / markContentPostFailed", () => {
  it("marks a post published with its external id", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    const post = await createContentPost({
      organizationId: org.id,
      platform: "FACEBOOK",
      imageUrls: ["https://example.com/a.png"],
      scheduledFor: new Date(),
    });

    const updated = await markContentPostPublished(post.id, "fb_post_123");
    expect(updated.status).toBe("PUBLISHED");
    expect(updated.externalPostId).toBe("fb_post_123");
    expect(updated.publishedAt).not.toBeNull();
  });

  it("marks a post failed with an error message", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    const post = await createContentPost({
      organizationId: org.id,
      platform: "FACEBOOK",
      imageUrls: ["https://example.com/a.png"],
      scheduledFor: new Date(),
    });

    const updated = await markContentPostFailed(post.id, "Graph API error");
    expect(updated.status).toBe("FAILED");
    expect(updated.errorMessage).toBe("Graph API error");
  });
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

describe("getLastPublishedPost", () => {
  it("returns the most recently published post", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    await prisma.contentPost.create({
      data: {
        organizationId: org.id,
        platform: "INSTAGRAM",
        type: "POST",
        status: "PUBLISHED",
        publishedAt: new Date("2026-09-10T09:00:00Z"),
      },
    });
    const newest = await prisma.contentPost.create({
      data: {
        organizationId: org.id,
        platform: "FACEBOOK",
        type: "POST",
        status: "PUBLISHED",
        publishedAt: new Date("2026-09-12T09:00:00Z"),
      },
    });

    const result = await getLastPublishedPost(org.id);
    expect(result?.id).toBe(newest.id);
  });

  it("returns null when nothing has been published yet", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    await createContentPost({
      organizationId: org.id,
      platform: "INSTAGRAM",
      imageUrls: ["https://example.com/a.png"],
      scheduledFor: new Date("2026-09-20T09:00:00Z"),
    });

    expect(await getLastPublishedPost(org.id)).toBeNull();
  });
});

describe("getNextScheduledPost", () => {
  it("returns the soonest upcoming scheduled post", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    const soonest = await createContentPost({
      organizationId: org.id,
      platform: "INSTAGRAM",
      imageUrls: ["https://example.com/a.png"],
      scheduledFor: new Date("2026-09-14T09:00:00Z"),
    });
    await createContentPost({
      organizationId: org.id,
      platform: "FACEBOOK",
      imageUrls: ["https://example.com/b.png"],
      scheduledFor: new Date("2026-09-20T09:00:00Z"),
    });

    const result = await getNextScheduledPost(
      org.id,
      new Date("2026-09-13T00:00:00Z"),
    );
    expect(result?.id).toBe(soonest.id);
  });

  it("excludes posts that are already due", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    await createContentPost({
      organizationId: org.id,
      platform: "INSTAGRAM",
      imageUrls: ["https://example.com/a.png"],
      scheduledFor: new Date("2026-09-10T09:00:00Z"),
    });

    const result = await getNextScheduledPost(
      org.id,
      new Date("2026-09-13T00:00:00Z"),
    );
    expect(result).toBeNull();
  });
});
