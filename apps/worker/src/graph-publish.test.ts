import { afterEach, describe, expect, it, vi } from "vitest";
import { publishToFacebook, publishToInstagram } from "./graph-publish";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("publishToInstagram", () => {
  it("creates a media container then publishes it, returning the post id", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "creation-123" }), { status: 200 }),
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
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]![0])).toContain("/ig-1/media?");
    expect(String(fetchMock.mock.calls[1]![0])).toContain("/ig-1/media_publish?");
    expect(String(fetchMock.mock.calls[1]![0])).toContain("creation_id=creation-123");
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
