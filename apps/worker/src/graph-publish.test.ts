import { afterEach, describe, expect, it, vi } from "vitest";
import {
  publishFacebookStory,
  publishInstagramStory,
  publishToFacebook,
  publishToInstagram,
} from "./graph-publish";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("publishToInstagram", () => {
  it("creates a media container, waits for it to finish, then publishes it", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "creation-123" }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status_code: "FINISHED" }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "post-456" }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const postId = await publishToInstagram({
      pageAccessToken: "token",
      igUserId: "ig-1",
      imageUrl: "https://example.com/a.png",
      caption: "Hello world",
    });

    expect(postId).toBe("post-456");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[0]![0])).toContain("/ig-1/media?");
    expect(String(fetchMock.mock.calls[1]![0])).toContain("/creation-123?");
    expect(String(fetchMock.mock.calls[1]![0])).toContain("fields=status_code");
    expect(String(fetchMock.mock.calls[2]![0])).toContain("/ig-1/media_publish?");
    expect(String(fetchMock.mock.calls[2]![0])).toContain("creation_id=creation-123");
  });

  it("polls until the container reports FINISHED, not just on the first check", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "creation-123" }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status_code: "IN_PROGRESS" }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status_code: "IN_PROGRESS" }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status_code: "FINISHED" }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "post-456" }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const postId = await publishToInstagram(
      {
        pageAccessToken: "token",
        igUserId: "ig-1",
        imageUrl: "https://example.com/a.png",
        caption: "Hello world",
      },
      { pollIntervalMs: 0 },
    );

    expect(postId).toBe("post-456");
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("throws if the container ends up in an ERROR state", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "creation-123" }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status_code: "ERROR" }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      publishToInstagram({
        pageAccessToken: "token",
        igUserId: "ig-1",
        imageUrl: "https://example.com/a.png",
        caption: "Hi",
      }),
    ).rejects.toThrow(/failed to process/i);
  });

  it("throws if the container never finishes within the timeout", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "creation-123" }), { status: 200 }),
      )
      .mockResolvedValue(
        new Response(JSON.stringify({ status_code: "IN_PROGRESS" }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      publishToInstagram(
        {
          pageAccessToken: "token",
          igUserId: "ig-1",
          imageUrl: "https://example.com/a.png",
          caption: "Hi",
        },
        { pollIntervalMs: 0, timeoutMs: 0 },
      ),
    ).rejects.toThrow(/did not finish processing in time/i);
  });

  it("throws with the response body when container creation fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("bad token", { status: 401 })),
    );

    await expect(
      publishToInstagram({
        pageAccessToken: "token",
        igUserId: "ig-1",
        imageUrl: "https://example.com/a.png",
        caption: "Hi",
      }),
    ).rejects.toThrow(/bad token/);
  });
});

describe("publishToFacebook", () => {
  it("posts a photo and returns the post id", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ post_id: "page_123_456", id: "456" }), {
          status: 200,
        }),
      ),
    );

    const postId = await publishToFacebook({
      pageAccessToken: "token",
      pageId: "page-1",
      imageUrl: "https://example.com/a.png",
      caption: "Hello",
    });

    expect(postId).toBe("page_123_456");
  });

  it("falls back to the bare id when post_id is absent", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ id: "456" }), { status: 200 }),
      ),
    );

    const postId = await publishToFacebook({
      pageAccessToken: "token",
      pageId: "page-1",
      imageUrl: "https://example.com/a.png",
      caption: "Hello",
    });

    expect(postId).toBe("456");
  });
});

describe("publishInstagramStory", () => {
  it("creates a STORIES container (no caption) then publishes it", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "creation-1" }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status_code: "FINISHED" }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "story-1" }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const storyId = await publishInstagramStory({
      pageAccessToken: "token",
      accountId: "ig-1",
      imageUrl: "https://example.com/a.png",
    });

    expect(storyId).toBe("story-1");
    const createUrl = String(fetchMock.mock.calls[0]![0]);
    expect(createUrl).toContain("/ig-1/media?");
    expect(createUrl).toContain("media_type=STORIES");
    expect(createUrl).not.toContain("caption=");
    expect(String(fetchMock.mock.calls[2]![0])).toContain("/ig-1/media_publish?");
  });
});

describe("publishFacebookStory", () => {
  it("uploads an unpublished photo, then turns it into a Story", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "photo-1" }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ post_id: "page_1_story_1", id: "story-1" }), {
          status: 200,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const storyId = await publishFacebookStory({
      pageAccessToken: "token",
      accountId: "page-1",
      imageUrl: "https://example.com/a.png",
    });

    expect(storyId).toBe("page_1_story_1");
    const uploadUrl = String(fetchMock.mock.calls[0]![0]);
    expect(uploadUrl).toContain("/page-1/photos?");
    expect(uploadUrl).toContain("published=false");
    const storyUrl = String(fetchMock.mock.calls[1]![0]);
    expect(storyUrl).toContain("/page-1/photo_stories?");
    expect(storyUrl).toContain("photo_id=photo-1");
  });

  it("falls back to the bare id when post_id is absent", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({ id: "photo-1" }), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ id: "story-1" }), { status: 200 })),
    );

    const storyId = await publishFacebookStory({
      pageAccessToken: "token",
      accountId: "page-1",
      imageUrl: "https://example.com/a.png",
    });

    expect(storyId).toBe("story-1");
  });
});
