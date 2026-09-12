import {
  encryptToken,
  SocialAccountAlreadyConnectedError,
  upsertSocialAccount,
} from "@socialpilot/db";
import { NextResponse, type NextRequest } from "next/server";
import { META_OAUTH_STATE_COOKIE } from "@/app/api/meta/connect/route";
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  getManagedPagesWithInstagram,
} from "@/lib/meta";
import {
  getPendingSignup,
  setPendingSignupCookie,
  type PendingMetaPage,
} from "@/lib/pending-signup";
import { getSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  const [session, pending] = await Promise.all([
    getSession(),
    getPendingSignup(),
  ]);
  if (!session && !pending) {
    return NextResponse.redirect(new URL("/pricing", request.url));
  }

  // Existing customers land back on their accounts list; a mid-signup
  // visitor (no session yet) lands back on /connect to see the result.
  const fallbackUrl = new URL(
    session ? "/dashboard/accounts" : "/connect",
    request.url,
  );

  function redirectWith(params: Record<string, string>): NextResponse {
    const url = new URL(fallbackUrl);
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

    if (session) {
      // Instagram publishing/reading for a Page's linked IG account is done
      // with the Page's own access token, not a separate "IG token" - Meta
      // doesn't issue one.
      let connectedCount = 0;
      for (const page of pages) {
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
    }

    // Pre-account signup: there's no organization yet to attach these to,
    // so stash the page (token encrypted, same as at-rest storage) in the
    // pending-signup cookie until account creation commits it for real.
    if (pages.length === 0) {
      return redirectWith({
        error:
          "No Facebook Pages found. Make sure you selected a Page when connecting.",
      });
    }

    // Only one Page's worth of data fits comfortably in a cookie once
    // tokens are encrypted - a user who administers several Pages (common
    // for agencies, or anyone who co-manages a community page) would blow
    // past the ~4KB per-cookie limit if every Page were included, and the
    // browser silently drops the cookie rather than erroring, which looks
    // exactly like the connection did nothing. Picking the Page with a
    // linked Instagram Business account (falling back to the first Page)
    // also matches what this product actually needs: one brand's Page +
    // Instagram, not every Page the connecting user happens to help admin.
    const page =
      pages.find((candidate) => candidate.instagramBusinessAccount) ??
      pages[0]!;

    const metaPages: PendingMetaPage[] = [
      {
        provider: "FACEBOOK",
        externalId: page.id,
        displayName: page.name,
        encryptedAccessToken: encryptToken(page.accessToken),
        tokenExpiresAt: tokenExpiresAt?.toISOString(),
      },
    ];

    if (page.instagramBusinessAccount) {
      metaPages.push({
        provider: "INSTAGRAM",
        externalId: page.instagramBusinessAccount.id,
        displayName: page.instagramBusinessAccount.username,
        profilePictureUrl: page.instagramBusinessAccount.profilePictureUrl,
        encryptedAccessToken: encryptToken(page.accessToken),
        tokenExpiresAt: tokenExpiresAt?.toISOString(),
      });
    }

    await setPendingSignupCookie({ ...pending!, metaPages });
    return redirectWith({});
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
