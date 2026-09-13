import { createContentPost, prisma, upsertSocialAccount } from "@socialpilot/db";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runPublishCycle } from "./publisher";

// TOKEN_ENCRYPTION_KEY and DATABASE_URL come from the global test env.

afterEach(async () => {
  await prisma.organization.deleteMany();
  vi.unstubAllGlobals();
});

describe("runPublishCycle", () => {
  it("publishes a due Instagram post and marks it PUBLISHED with the external id", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    await upsertSocialAccount({
      organizationId: org.id,
      provider: "INSTAGRAM",
      externalId: "ig-1",
      accessToken: "raw-page-token",
    });
    const post = await createContentPost({
      organizationId: org.id,
      platform: "INSTAGRAM",
      caption: "Weekend special!",
      hashtags: ["#offer"],
      imageUrls: ["https://example.com/a.png"],
      scheduledFor: new Date(Date.now() - 60_000),
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "creation-1" }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status_code: "FINISHED" }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "ig-post-1" }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await runPublishCycle();

    const updated = await prisma.contentPost.findUniqueOrThrow({
      where: { id: post.id },
    });
    expect(updated.status).toBe("PUBLISHED");
    expect(updated.externalPostId).toBe("ig-post-1");
    expect(updated.publishedAt).not.toBeNull();
  });

  it("marks a post FAILED when no matching social account is connected", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    const post = await createContentPost({
      organizationId: org.id,
      platform: "FACEBOOK",
      imageUrls: ["https://example.com/a.png"],
      scheduledFor: new Date(Date.now() - 60_000),
    });

    await runPublishCycle();

    const updated = await prisma.contentPost.findUniqueOrThrow({
      where: { id: post.id },
    });
    expect(updated.status).toBe("FAILED");
    expect(updated.errorMessage).toMatch(/No connected FACEBOOK account/);
  });

  it("does not touch a post that isn't due yet", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    const post = await createContentPost({
      organizationId: org.id,
      platform: "INSTAGRAM",
      imageUrls: ["https://example.com/a.png"],
      scheduledFor: new Date(Date.now() + 60_000 * 60),
    });

    vi.stubGlobal("fetch", vi.fn());
    await runPublishCycle();

    const updated = await prisma.contentPost.findUniqueOrThrow({
      where: { id: post.id },
    });
    expect(updated.status).toBe("SCHEDULED");
  });

  it("continues to the next post when one fails", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    const failing = await createContentPost({
      organizationId: org.id,
      platform: "FACEBOOK",
      imageUrls: ["https://example.com/a.png"],
      scheduledFor: new Date(Date.now() - 60_000),
    });
    await upsertSocialAccount({
      organizationId: org.id,
      provider: "INSTAGRAM",
      externalId: "ig-1",
      accessToken: "raw-page-token",
    });
    const succeeding = await createContentPost({
      organizationId: org.id,
      platform: "INSTAGRAM",
      imageUrls: ["https://example.com/b.png"],
      scheduledFor: new Date(Date.now() - 30_000),
    });

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({ id: "creation-1" }), { status: 200 }))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ status_code: "FINISHED" }), { status: 200 }),
        )
        .mockResolvedValueOnce(new Response(JSON.stringify({ id: "ig-post-1" }), { status: 200 })),
    );

    await runPublishCycle();

    const failedPost = await prisma.contentPost.findUniqueOrThrow({ where: { id: failing.id } });
    const publishedPost = await prisma.contentPost.findUniqueOrThrow({ where: { id: succeeding.id } });
    expect(failedPost.status).toBe("FAILED");
    expect(publishedPost.status).toBe("PUBLISHED");
  });

  it("also publishes an Instagram Story when the post has a storyImageUrl", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    await upsertSocialAccount({
      organizationId: org.id,
      provider: "INSTAGRAM",
      externalId: "ig-1",
      accessToken: "raw-page-token",
    });
    await prisma.contentPost.create({
      data: {
        organizationId: org.id,
        platform: "INSTAGRAM",
        type: "POST",
        status: "SCHEDULED",
        imageUrls: ["https://example.com/a.png"],
        storyImageUrl: "https://example.com/a-story.png",
        scheduledFor: new Date(Date.now() - 60_000),
      },
    });

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        // Main post: create container, wait, publish.
        .mockResolvedValueOnce(new Response(JSON.stringify({ id: "creation-1" }), { status: 200 }))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ status_code: "FINISHED" }), { status: 200 }),
        )
        .mockResolvedValueOnce(new Response(JSON.stringify({ id: "ig-post-1" }), { status: 200 }))
        // Story: create container, wait, publish.
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ id: "story-creation-1" }), { status: 200 }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ status_code: "FINISHED" }), { status: 200 }),
        )
        .mockResolvedValueOnce(new Response(JSON.stringify({ id: "ig-story-1" }), { status: 200 })),
    );

    await runPublishCycle();

    const story = await prisma.contentPost.findFirstOrThrow({
      where: { organizationId: org.id, type: "STORY" },
    });
    expect(story.status).toBe("PUBLISHED");
    expect(story.externalPostId).toBe("ig-story-1");
    expect(story.imageUrls).toEqual(["https://example.com/a-story.png"]);
  });

  it("does not attempt a Story publish when storyImageUrl is absent", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    await upsertSocialAccount({
      organizationId: org.id,
      provider: "INSTAGRAM",
      externalId: "ig-1",
      accessToken: "raw-page-token",
    });
    await createContentPost({
      organizationId: org.id,
      platform: "INSTAGRAM",
      imageUrls: ["https://example.com/a.png"],
      scheduledFor: new Date(Date.now() - 60_000),
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "creation-1" }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status_code: "FINISHED" }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "ig-post-1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await runPublishCycle();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const storyCount = await prisma.contentPost.count({
      where: { organizationId: org.id, type: "STORY" },
    });
    expect(storyCount).toBe(0);
  });

  it("keeps the main post PUBLISHED even if the Story publish fails", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    await upsertSocialAccount({
      organizationId: org.id,
      provider: "INSTAGRAM",
      externalId: "ig-1",
      accessToken: "raw-page-token",
    });
    const post = await prisma.contentPost.create({
      data: {
        organizationId: org.id,
        platform: "INSTAGRAM",
        type: "POST",
        status: "SCHEDULED",
        imageUrls: ["https://example.com/a.png"],
        storyImageUrl: "https://example.com/a-story.png",
        scheduledFor: new Date(Date.now() - 60_000),
      },
    });

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({ id: "creation-1" }), { status: 200 }))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ status_code: "FINISHED" }), { status: 200 }),
        )
        .mockResolvedValueOnce(new Response(JSON.stringify({ id: "ig-post-1" }), { status: 200 }))
        // Story container creation fails outright.
        .mockResolvedValueOnce(new Response("rate limited", { status: 429 })),
    );

    await runPublishCycle();

    const updated = await prisma.contentPost.findUniqueOrThrow({ where: { id: post.id } });
    expect(updated.status).toBe("PUBLISHED");
    expect(updated.externalPostId).toBe("ig-post-1");
    const storyCount = await prisma.contentPost.count({
      where: { organizationId: org.id, type: "STORY" },
    });
    expect(storyCount).toBe(0);
  });

  it("also publishes a Facebook Story via the photo-upload-then-story flow", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme" } });
    await upsertSocialAccount({
      organizationId: org.id,
      provider: "FACEBOOK",
      externalId: "page-1",
      accessToken: "raw-page-token",
    });
    await prisma.contentPost.create({
      data: {
        organizationId: org.id,
        platform: "FACEBOOK",
        type: "POST",
        status: "SCHEDULED",
        imageUrls: ["https://example.com/a.png"],
        storyImageUrl: "https://example.com/a-story.png",
        scheduledFor: new Date(Date.now() - 60_000),
      },
    });

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        // Main post: single photo post.
        .mockResolvedValueOnce(new Response(JSON.stringify({ id: "fb-post-1" }), { status: 200 }))
        // Story: unpublished photo upload, then photo_stories.
        .mockResolvedValueOnce(new Response(JSON.stringify({ id: "photo-1" }), { status: 200 }))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ post_id: "page_1_story_1" }), { status: 200 }),
        ),
    );

    await runPublishCycle();

    const story = await prisma.contentPost.findFirstOrThrow({
      where: { organizationId: org.id, type: "STORY" },
    });
    expect(story.status).toBe("PUBLISHED");
    expect(story.externalPostId).toBe("page_1_story_1");
  });
});
