import { SocialAccountAlreadyConnectedError, upsertSocialAccount } from "@socialpilot/db";
import { NextResponse, type NextRequest } from "next/server";
import { META_OAUTH_STATE_COOKIE } from "@/app/api/meta/connect/route";
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  getManagedPagesWithInstagram,
} from "@/lib/meta";
import { getSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const accountsUrl = new URL("/dashboard/accounts", request.url);

  function redirectWith(params: Record<string, string>): NextResponse {
    const url = new URL(accountsUrl);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    const response = NextResponse.redirect(url);
    response.cookies.delete(META_OAUTH_STATE_COOKIE);
    return response;
  }

  const oauthError = request.nextUrl.searchParams.get("error");
  if (oauthError) {
    return redirectWith({ error: "Connection was cancelled." });
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get(META_OAUTH_STATE_COOKIE)?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectWith({
      error: "Invalid connection request. Please try connecting again.",
    });
  }

  try {
    const redirectUri = new URL(
      "/api/meta/callback",
      request.url,
    ).toString();
    const shortLivedToken = await exchangeCodeForToken(code, redirectUri);
    const { accessToken: longLivedToken, expiresInSeconds } =
      await exchangeForLongLivedToken(shortLivedToken);
    const pages = await getManagedPagesWithInstagram(longLivedToken);

    const tokenExpiresAt = expiresInSeconds
      ? new Date(Date.now() + expiresInSeconds * 1000)
      : undefined;

    let connectedCount = 0;
    for (const page of pages) {
      // Instagram publishing/reading for a Page's linked IG account is done
      // with the Page's own access token, not a separate "IG token" - Meta
      // doesn't issue one.
      await upsertSocialAccount({
        organizationId: session.organizationId,
        provider: "FACEBOOK",
        externalId: page.id,
        displayName: page.name,
        accessToken: page.accessToken,
        tokenExpiresAt,
      });
      connectedCount++;

      if (page.instagramBusinessAccount) {
        await upsertSocialAccount({
          organizationId: session.organizationId,
          provider: "INSTAGRAM",
          externalId: page.instagramBusinessAccount.id,
          displayName: page.instagramBusinessAccount.username,
          profilePictureUrl: page.instagramBusinessAccount.profilePictureUrl,
          accessToken: page.accessToken,
          tokenExpiresAt,
        });
        connectedCount++;
      }
    }

    if (connectedCount === 0) {
      return redirectWith({
        error:
          "No Facebook Pages found. Make sure you selected a Page when connecting.",
      });
    }
    return redirectWith({ connected: String(connectedCount) });
  } catch (error) {
    if (error instanceof SocialAccountAlreadyConnectedError) {
      return redirectWith({
        error:
          "One of these accounts is already connected to a different SocialPilot organization.",
      });
    }
    console.error("Meta OAuth callback failed", error);
    return redirectWith({
      error: "Something went wrong connecting your accounts. Please try again.",
    });
  }
}
