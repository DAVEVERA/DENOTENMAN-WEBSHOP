import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { buildGoogleBusinessAuthUrl, isGoogleBusinessLoginConfigured } from "@/lib/business-google-auth";
import { BASE_URL } from "@/lib/routes";

export const runtime = "nodejs";

export const GOOGLE_OAUTH_STATE_COOKIE = "denotenman_business_google_state";

export async function GET() {
  if (!isGoogleBusinessLoginConfigured()) {
    return NextResponse.redirect(new URL("/nl/zakelijk/inloggen?error=google_unavailable", BASE_URL));
  }

  const state = randomBytes(24).toString("base64url");
  const response = NextResponse.redirect(buildGoogleBusinessAuthUrl(state));
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Google's redirect back to our callback is a top-level cross-site
    // navigation; "lax" is required for the cookie to survive that hop.
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });
  return response;
}
