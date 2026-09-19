import {
  encryptToken,
  SocialAccountAlreadyConnectedError,
  SocialAccountLimitError,
  upsertSocialAccount,
} from "@socialpilot/db";
import { getTranslations } from "next-intl/server";
import { NextResponse, type NextRequest } from "next/server";
import { META_OAUTH_STATE_COOKIE } from "@/app/api/meta/connect/route";
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  getManagedPagesWithInstagram,
} from "@/lib/meta";
import { setMetaPageChoiceCookie } from "@/lib/meta-page-choice";
import {
  getPendingSignup,
  setPendingSignupCookie,
  type PendingMetaPage,
} from "@/lib/pending-signup";
import { getSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  const [session, pending, t] = await Promise.all([
    getSession(),
    getPendingSignup(),
    getTranslations("metaConnect"),
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
    return redirectWith({ error: t("cancelled") });
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get(META_OAUTH_STATE_COOKIE)?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectWith({ error: t("invalidRequest") });
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

    if (pages.length === 0) {
      return redirectWith({ error: t("noPagesFound") });
    }

    // Multiple Pages: ask which one, rather than guessing or (for the
    // pre-account path) trying to cram every Page's encrypted token into a
    // single cookie - a handful of Pages already blows past the ~4KB
    // per-cookie limit browsers enforce, and it silently gets dropped.
    if (pages.length > 1) {
      await setMetaPageChoiceCookie({
        encryptedUserToken: encryptToken(longLivedToken),
        choices: pages.map((page) => ({
          id: page.id,
          name: page.name,
          hasInstagram: Boolean(page.instagramBusinessAccount),
        })),
        target: session ? "session" : "pending",
      });
      const response = NextResponse.redirect(
        new URL("/connect/choose-page", request.url),
      );
      response.cookies.delete(META_OAUTH_STATE_COOKIE);
      return response;
    }

    const page = pages[0]!;

    if (session) {
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
      let connectedCount = 1;

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

      return redirectWith({ connected: String(connectedCount) });
    }

    // Pre-account signup: there's no organization yet to attach this to,
    // so stash the page (token encrypted, same as at-rest storage) in the
    // pending-signup cookie until account creation commits it for real.
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
      return redirectWith({ error: t("alreadyConnected") });
    }
    if (error instanceof SocialAccountLimitError) {
      return redirectWith({ error: t("accountLimitReached") });
    }
    console.error("Meta OAuth callback failed", error);
    return redirectWith({ error: t("genericFailure") });
  }
}
