import { afterEach, describe, expect, it } from "vitest";
import {
  countContentPosts,
  createContentPost,
  deleteContentPost,
  findImageForDay,
  getContentPost,
  getLastPublishedPost,
  getNextScheduledPost,
  listContentPostsInRange,
  listDuePosts,
  markContentPostFailed,
  markContentPostPublished,
  recordPublishedStory,
  updateContentPost,
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
    expect(post.storyImageUrl).toBeNull();
  });

  it("stores a pre-rendered story image URL alongside the post when given one", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });

    const post = await createContentPost({
      organizationId: org.id,
      platform: "INSTAGRAM",
      imageUrls: ["https://example.com/a.png"],
      storyImageUrl: "https://example.com/a-story.png",
      scheduledFor: new Date("2026-09-20T09:00:00Z"),
    });

    expect(post.storyImageUrl).toBe("https://example.com/a-story.png");
  });
});

describe("countContentPosts", () => {
  it("counts only posts belonging to the organization", async () => {
    const orgA = await prisma.organization.create({ data: { name: "A" } });
    const orgB = await prisma.organization.create({ data: { name: "B" } });
    await createContentPost({
      organizationId: orgA.id,
      platform: "INSTAGRAM",
      imageUrls: ["https://example.com/a.png"],
      scheduledFor: new Date("2026-09-20T09:00:00Z"),
    });
    await createContentPost({
      organizationId: orgA.id,
      platform: "FACEBOOK",
      imageUrls: ["https://example.com/b.png"],
      scheduledFor: new Date("2026-09-21T09:00:00Z"),
    });
    await createContentPost({
      organizationId: orgB.id,
      platform: "INSTAGRAM",
      imageUrls: ["https://example.com/c.png"],
      scheduledFor: new Date("2026-09-20T09:00:00Z"),
    });

    expect(await countContentPosts(orgA.id)).toBe(2);
    expect(await countContentPosts(orgB.id)).toBe(1);
  });

  it("returns 0 for an organization with no posts", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    expect(await countContentPosts(org.id)).toBe(0);
  });
});

describe("findImageForDay", () => {
  const dayStart = new Date("2026-09-13T00:00:00.000Z");
  const dayEnd = new Date("2026-09-14T00:00:00.000Z");

  it("returns null when nothing has been generated for that day yet", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    expect(await findImageForDay(org.id, dayStart, dayEnd)).toBeNull();
  });

  it("returns the image and story image of an existing post that day", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    await createContentPost({
      organizationId: org.id,
      platform: "INSTAGRAM",
      imageUrls: ["https://example.com/master.png"],
      storyImageUrl: "https://example.com/master-story.png",
      scheduledFor: new Date("2026-09-13T10:00:00.000Z"),
    });

    const result = await findImageForDay(org.id, dayStart, dayEnd);
    expect(result?.imageUrl).toBe("https://example.com/master.png");
    expect(result?.storyImageUrl).toBe("https://example.com/master-story.png");
    expect(result?.createdAt).toBeInstanceOf(Date);
  });

  it("finds it regardless of which platform the existing post was for", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    await createContentPost({
      organizationId: org.id,
      platform: "FACEBOOK",
      imageUrls: ["https://example.com/master.png"],
      scheduledFor: new Date("2026-09-13T10:00:00.000Z"),
    });

    const result = await findImageForDay(org.id, dayStart, dayEnd);
    expect(result?.imageUrl).toBe("https://example.com/master.png");
  });

  it("ignores posts scheduled on a different day", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    await createContentPost({
      organizationId: org.id,
      platform: "INSTAGRAM",
      imageUrls: ["https://example.com/other-day.png"],
      scheduledFor: new Date("2026-09-14T10:00:00.000Z"),
    });

    expect(await findImageForDay(org.id, dayStart, dayEnd)).toBeNull();
  });

  it("ignores STORY-type rows - only reuses a POST's image", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    await recordPublishedStory({
      organizationId: org.id,
      platform: "INSTAGRAM",
      imageUrls: ["https://example.com/a-story.png"],
      externalPostId: "ig-story-1",
    });

    // recordPublishedStory always uses the current moment, so bound the
    // window around "now" rather than the fixed Sept-13 window above -
    // otherwise this would only actually exercise the type filter when
    // the suite happens to run on that date.
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    expect(await findImageForDay(org.id, todayStart, todayEnd)).toBeNull();
  });
});

describe("recordPublishedStory", () => {
  it("creates an already-PUBLISHED STORY post", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });

    const story = await recordPublishedStory({
      organizationId: org.id,
      platform: "INSTAGRAM",
      caption: "Weekend special!",
      hashtags: ["#offer"],
      imageUrls: ["https://example.com/story.png"],
      externalPostId: "ig-story-123",
    });

    expect(story.type).toBe("STORY");
    expect(story.status).toBe("PUBLISHED");
    expect(story.publishedAt).not.toBeNull();
    expect(story.externalPostId).toBe("ig-story-123");
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

describe("getContentPost", () => {
  it("returns a post belonging to the organization", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    const post = await createContentPost({
      organizationId: org.id,
      platform: "INSTAGRAM",
      imageUrls: ["https://example.com/a.png"],
      scheduledFor: new Date("2026-09-14T09:00:00Z"),
    });

    const result = await getContentPost(org.id, post.id);
    expect(result?.id).toBe(post.id);
  });

  it("returns null for a post belonging to a different organization", async () => {
    const orgA = await prisma.organization.create({ data: { name: "A" } });
    const orgB = await prisma.organization.create({ data: { name: "B" } });
    const post = await createContentPost({
      organizationId: orgA.id,
      platform: "INSTAGRAM",
      imageUrls: ["https://example.com/a.png"],
      scheduledFor: new Date("2026-09-14T09:00:00Z"),
    });

    expect(await getContentPost(orgB.id, post.id)).toBeNull();
  });
});

describe("updateContentPost", () => {
  it("updates the caption and scheduled time of a post belonging to the organization", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    const post = await createContentPost({
      organizationId: org.id,
      platform: "INSTAGRAM",
      caption: "Old caption",
      imageUrls: ["https://example.com/a.png"],
      scheduledFor: new Date("2026-09-14T09:00:00Z"),
    });

    const updated = await updateContentPost(org.id, post.id, {
      caption: "New caption",
      scheduledFor: new Date("2026-09-15T10:00:00Z"),
    });

    expect(updated?.caption).toBe("New caption");
    expect(updated?.scheduledFor?.toISOString()).toBe("2026-09-15T10:00:00.000Z");
  });

  it("returns null and does not update a post belonging to a different organization", async () => {
    const orgA = await prisma.organization.create({ data: { name: "A" } });
    const orgB = await prisma.organization.create({ data: { name: "B" } });
    const post = await createContentPost({
      organizationId: orgA.id,
      platform: "INSTAGRAM",
      caption: "Original",
      imageUrls: ["https://example.com/a.png"],
      scheduledFor: new Date("2026-09-14T09:00:00Z"),
    });

    const result = await updateContentPost(orgB.id, post.id, { caption: "Hacked" });
    expect(result).toBeNull();

    const untouched = await prisma.contentPost.findUniqueOrThrow({ where: { id: post.id } });
    expect(untouched.caption).toBe("Original");
  });
});

describe("deleteContentPost", () => {
  it("deletes a post belonging to the organization", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    const post = await createContentPost({
      organizationId: org.id,
      platform: "INSTAGRAM",
      imageUrls: ["https://example.com/a.png"],
      scheduledFor: new Date("2026-09-14T09:00:00Z"),
    });

    const deleted = await deleteContentPost(org.id, post.id);
    expect(deleted).toBe(true);

    await expect(
      prisma.contentPost.findUniqueOrThrow({ where: { id: post.id } }),
    ).rejects.toThrow();
  });

  it("does not delete a post belonging to a different organization", async () => {
    const orgA = await prisma.organization.create({ data: { name: "A" } });
    const orgB = await prisma.organization.create({ data: { name: "B" } });
    const post = await createContentPost({
      organizationId: orgA.id,
      platform: "INSTAGRAM",
      imageUrls: ["https://example.com/a.png"],
      scheduledFor: new Date("2026-09-14T09:00:00Z"),
    });

    const deleted = await deleteContentPost(orgB.id, post.id);
    expect(deleted).toBe(false);

    const stillThere = await prisma.contentPost.findUnique({ where: { id: post.id } });
    expect(stillThere).not.toBeNull();
  });
});
