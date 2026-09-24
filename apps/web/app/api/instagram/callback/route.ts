import {
  encryptToken,
  SocialAccountAlreadyConnectedError,
  SocialAccountLimitError,
  upsertSocialAccount,
} from "@socialpilot/db";
import { getTranslations } from "next-intl/server";
import { NextResponse, type NextRequest } from "next/server";
import { INSTAGRAM_OAUTH_STATE_COOKIE } from "@/app/api/instagram/connect/route";
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  getInstagramAccountInfo,
} from "@/lib/instagram";
import {
  getPendingSignup,
  setPendingSignupCookie,
  type PendingMetaPage,
} from "@/lib/pending-signup";
import { getSession } from "@/lib/session";

/** Mirrors api/meta/callback/route.ts, simpler by construction: this
 * product has no concept of "Pages" at all, so there's never a picker step
 * - the authenticated Instagram account is unconditionally the one and
 * only thing this token can act as. */
export async function GET(request: NextRequest) {
  const [session, pending, t] = await Promise.all([
    getSession(),
    getPendingSignup(),
    getTranslations("metaConnect"),
  ]);
  if (!session && !pending) {
    return NextResponse.redirect(new URL("/pricing", request.url));
  }

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
    response.cookies.delete(INSTAGRAM_OAUTH_STATE_COOKIE);
    return response;
  }

  const oauthError = request.nextUrl.searchParams.get("error");
  if (oauthError) {
    return redirectWith({ error: t("cancelled") });
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get(INSTAGRAM_OAUTH_STATE_COOKIE)?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectWith({ error: t("invalidRequest") });
  }

  try {
    const redirectUri = new URL(
      "/api/instagram/callback",
      request.url,
    ).toString();
    const shortLivedToken = await exchangeCodeForToken(code, redirectUri);
    const { accessToken: longLivedToken, expiresInSeconds } =
      await exchangeForLongLivedToken(shortLivedToken);
    const account = await getInstagramAccountInfo(longLivedToken);

    const tokenExpiresAt = expiresInSeconds
      ? new Date(Date.now() + expiresInSeconds * 1000)
      : undefined;

    if (session) {
      await upsertSocialAccount({
        organizationId: session.organizationId,
        provider: "INSTAGRAM",
        externalId: account.id,
        displayName: account.username,
        profilePictureUrl: account.profilePictureUrl,
        accessToken: longLivedToken,
        tokenExpiresAt,
        authMethod: "INSTAGRAM_LOGIN",
      });
      return redirectWith({ connected: "1" });
    }

    // Pre-account signup: stash it (token encrypted, same as at-rest
    // storage) in the pending-signup cookie until account creation
    // commits it for real, same pattern as the Facebook Login path.
    const metaPages: PendingMetaPage[] = [
      {
        provider: "INSTAGRAM",
        externalId: account.id,
        displayName: account.username,
        profilePictureUrl: account.profilePictureUrl,
        encryptedAccessToken: encryptToken(longLivedToken),
        tokenExpiresAt: tokenExpiresAt?.toISOString(),
        authMethod: "INSTAGRAM_LOGIN",
      },
    ];

    await setPendingSignupCookie({
      ...pending!,
      metaPages: [...(pending!.metaPages ?? []), ...metaPages],
    });
    return redirectWith({});
  } catch (error) {
    if (error instanceof SocialAccountAlreadyConnectedError) {
      return redirectWith({ error: t("alreadyConnected") });
    }
    if (error instanceof SocialAccountLimitError) {
      return redirectWith({ error: t("accountLimitReached") });
    }
    console.error("Instagram OAuth callback failed", error);
    return redirectWith({ error: t("genericFailure") });
  }
}
