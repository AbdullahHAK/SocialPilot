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
});
