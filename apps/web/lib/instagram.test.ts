import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  getInstagramAccountInfo,
  getInstagramOAuthUrl,
} from "./instagram";

beforeEach(() => {
  vi.stubEnv("INSTAGRAM_APP_ID", "test-ig-app-id");
  vi.stubEnv("INSTAGRAM_APP_SECRET", "test-ig-app-secret");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("getInstagramOAuthUrl", () => {
  it("builds an Instagram (not Facebook) OAuth dialog URL with the app id, redirect, and state", () => {
    const url = new URL(
      getInstagramOAuthUrl("https://example.com/api/instagram/callback", "csrf-state"),
    );

    expect(url.origin).toBe("https://api.instagram.com");
    expect(url.searchParams.get("client_id")).toBe("test-ig-app-id");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://example.com/api/instagram/callback",
    );
    expect(url.searchParams.get("state")).toBe("csrf-state");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toContain("instagram_business_content_publish");
  });
});

describe("exchangeCodeForToken", () => {
  it("posts a form-encoded body (not query params) and returns the access token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ access_token: "short-lived", user_id: "17841" }), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const token = await exchangeCodeForToken("auth-code", "https://example.com/callback");

    expect(token).toBe("short-lived");
    const [url, options] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("https://api.instagram.com/oauth/access_token");
    expect(options.method).toBe("POST");
    expect(options.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    const body = new URLSearchParams(options.body as string);
    expect(body.get("client_id")).toBe("test-ig-app-id");
    expect(body.get("client_secret")).toBe("test-ig-app-secret");
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code")).toBe("auth-code");
  });

  it("throws with the response body when Instagram returns an error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("invalid code", { status: 400 })));

    await expect(
      exchangeCodeForToken("bad-code", "https://example.com/callback"),
    ).rejects.toThrow(/invalid code/);
  });
});

describe("exchangeForLongLivedToken", () => {
  it("returns the long-lived access token and expiry from graph.instagram.com", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ access_token: "long-lived", token_type: "bearer", expires_in: 5184000 }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await exchangeForLongLivedToken("short-lived");

    expect(result).toEqual({ accessToken: "long-lived", expiresInSeconds: 5184000 });
    const url = String(fetchMock.mock.calls[0]![0]);
    expect(url).toContain("https://graph.instagram.com/access_token?");
    expect(url).toContain("grant_type=ig_exchange_token");
  });
});

describe("getInstagramAccountInfo", () => {
  it("fetches the authenticated account's own identity - no Page picker step exists for this product", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "17841400000",
          username: "acmebakery",
          profile_picture_url: "https://example.com/pic.jpg",
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const account = await getInstagramAccountInfo("user-token");

    expect(account).toEqual({
      id: "17841400000",
      username: "acmebakery",
      profilePictureUrl: "https://example.com/pic.jpg",
    });
    const url = String(fetchMock.mock.calls[0]![0]);
    expect(url).toContain("https://graph.instagram.com/v21.0/me?");
    expect(url).toContain("access_token=user-token");
  });

  it("throws with the response body on a non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("expired token", { status: 401 })));

    await expect(getInstagramAccountInfo("dead-token")).rejects.toThrow(/expired token/);
  });
});
