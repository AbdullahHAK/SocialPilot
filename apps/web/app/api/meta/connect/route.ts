import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getMetaOAuthUrl } from "@/lib/meta";
import { getPendingSignup } from "@/lib/pending-signup";
import { getSession } from "@/lib/session";

export const META_OAUTH_STATE_COOKIE = "sp_meta_oauth_state";

export async function GET(request: NextRequest) {
  // Reachable two ways: an existing customer connecting/reconnecting from
  // the dashboard (real session), or a new visitor mid-signup who has paid
  // but has no organization yet (pending-signup cookie only).
  const [session, pending] = await Promise.all([
    getSession(),
    getPendingSignup(),
  ]);
  if (!session && !pending) {
    return NextResponse.redirect(new URL("/pricing", request.url));
  }

  const state = randomBytes(16).toString("hex");
  const redirectUri = new URL("/api/meta/callback", request.url).toString();

  const response = NextResponse.redirect(getMetaOAuthUrl(redirectUri, state));
  response.cookies.set(META_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });
  return response;
}
