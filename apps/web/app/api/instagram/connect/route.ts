import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getInstagramCallbackUrl, getInstagramOAuthUrl } from "@/lib/instagram";
import { getPendingSignup } from "@/lib/pending-signup";
import { getSession } from "@/lib/session";

export const INSTAGRAM_OAUTH_STATE_COOKIE = "sp_instagram_oauth_state";

/** Mirrors api/meta/connect/route.ts exactly, for the "no Facebook Page"
 * path (see lib/instagram.ts). Kept as a fully separate state cookie from
 * Facebook's so a user can't have one flow's callback validated against
 * the other's state by mistake. */
export async function GET(request: NextRequest) {
  const [session, pending] = await Promise.all([
    getSession(),
    getPendingSignup(),
  ]);
  if (!session && !pending) {
    return NextResponse.redirect(new URL("/pricing", request.url));
  }

  const state = randomBytes(16).toString("hex");
  const redirectUri = getInstagramCallbackUrl(request.url);

  const response = NextResponse.redirect(getInstagramOAuthUrl(redirectUri, state));
  response.cookies.set(INSTAGRAM_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });
  return response;
}
