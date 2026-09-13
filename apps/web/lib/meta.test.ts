import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  getManagedPagesWithInstagram,
  getMetaOAuthUrl,
  getPageById,
  updateFacebookPostCaption,
} from "./meta";

beforeEach(() => {
  vi.stubEnv("META_APP_ID", "test-app-id");
  vi.stubEnv("META_APP_SECRET", "test-app-secret");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("getMetaOAuthUrl", () => {
  it("builds a Facebook OAuth dialog URL with the app id, redirect, and state", () => {
    const url = new URL(
      getMetaOAuthUrl("https://example.com/api/meta/callback", "csrf-state"),
    );

    expect(url.origin).toBe("https://www.facebook.com");
    expect(url.searchParams.get("client_id")).toBe("test-app-id");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://example.com/api/meta/callback",
    );
    expect(url.searchParams.get("state")).toBe("csrf-state");
    expect(url.searchParams.get("scope")).toContain("instagram_content_publish");
  });
});

describe("exchangeCodeForToken", () => {
  it("returns the access token from a successful response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ access_token: "short-lived", token_type: "bearer" }), {
          status: 200,
        }),
      ),
    );

    const token = await exchangeCodeForToken(
      "auth-code",
      "https://example.com/callback",
    );
    expect(token).toBe("short-lived");
  });

  it("throws with the response body when Meta returns an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("invalid code", { status: 400 }),
      ),
    );

    await expect(
      exchangeCodeForToken("bad-code", "https://example.com/callback"),
    ).rejects.toThrow(/invalid code/);
  });
});

describe("exchangeForLongLivedToken", () => {
  it("returns the long-lived access token and expiry", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            access_token: "long-lived",
            token_type: "bearer",
            expires_in: 5184000,
          }),
          { status: 200 },
        ),
      ),
    );

    const result = await exchangeForLongLivedToken("short-lived");
    expect(result).toEqual({
      accessToken: "long-lived",
      expiresInSeconds: 5184000,
    });
  });
});

describe("getManagedPagesWithInstagram", () => {
  it("maps Graph API pages into ManagedPage objects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: [
              {
                id: "page-1",
                name: "Acme Coffee",
                access_token: "page-token-1",
                instagram_business_account: {
                  id: "ig-1",
                  username: "acmecoffee",
                  profile_picture_url: "https://example.com/pic.jpg",
                },
              },
              {
                id: "page-2",
                name: "Acme Bakery",
                access_token: "page-token-2",
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );

    const pages = await getManagedPagesWithInstagram("user-token");
    expect(pages).toEqual([
      {
        id: "page-1",
        name: "Acme Coffee",
        accessToken: "page-token-1",
        instagramBusinessAccount: {
          id: "ig-1",
          username: "acmecoffee",
          profilePictureUrl: "https://example.com/pic.jpg",
        },
      },
      {
        id: "page-2",
        name: "Acme Bakery",
        accessToken: "page-token-2",
        instagramBusinessAccount: undefined,
      },
    ]);
  });
});

describe("getPageById", () => {
  it("fetches a single Page's token and linked Instagram account", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "page-1",
          name: "Acme Coffee",
          access_token: "page-token-1",
          instagram_business_account: {
            id: "ig-1",
            username: "acmecoffee",
            profile_picture_url: "https://example.com/pic.jpg",
          },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const page = await getPageById("user-token", "page-1");
    expect(page).toEqual({
      id: "page-1",
      name: "Acme Coffee",
      accessToken: "page-token-1",
      instagramBusinessAccount: {
        id: "ig-1",
        username: "acmecoffee",
        profilePictureUrl: "https://example.com/pic.jpg",
      },
    });
    expect(String(fetchMock.mock.calls[0]![0])).toContain("/page-1?");
  });
});

describe("updateFacebookPostCaption", () => {
  it("posts the new message to the post's Graph API endpoint", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await updateFacebookPostCaption("page-token", "page_123_456", "Updated caption");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = String(fetchMock.mock.calls[0]![0]);
    expect(url).toContain("/page_123_456?");
    expect(url).toContain("message=Updated+caption");
    expect(url).toContain("access_token=page-token");
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ method: "POST" });
  });

  it("throws with the response body when the update fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("expired token", { status: 401 })),
    );

    await expect(
      updateFacebookPostCaption("page-token", "page_123_456", "Updated caption"),
    ).rejects.toThrow(/expired token/);
  });
});
