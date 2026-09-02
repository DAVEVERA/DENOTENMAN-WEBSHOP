import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { BUSINESS_SESSION_COOKIE, createBusinessSession } from "@/lib/business-portal";
import { businessSessionCookieOptions } from "@/lib/business-portal-contract";
import { verifyGoogleBusinessAuthCode } from "@/lib/business-google-auth";
import { GOOGLE_OAUTH_STATE_COOKIE } from "../start/route";

export const runtime = "nodejs";

function loginPageError(request: NextRequest, error: string) {
  const url = new URL("/nl/zakelijk/inloggen", request.url);
  url.searchParams.set("error", error);
  const response = NextResponse.redirect(url);
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = request.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    return loginPageError(request, "google_failed");
  }

  let email: string;
  try {
    const verified = await verifyGoogleBusinessAuthCode(code);
    if (!verified.emailVerified) return loginPageError(request, "google_email_unverified");
    email = verified.email;
  } catch (error) {
    console.error("Google business login verification failed", error);
    return loginPageError(request, "google_failed");
  }

  const account = await prisma.businessAccount.findFirst({
    where: { email: { equals: email, mode: "insensitive" }, status: "APPROVED" },
  });
  if (!account) return loginPageError(request, "google_no_account");

  const { sessionToken, expiresAt } = await prisma.$transaction((tx) =>
    createBusinessSession(tx, { businessAccountId: account.id, contactName: account.contactName, via: "Google" })
  );

  const response = NextResponse.redirect(new URL("/nl/zakelijk", request.url));
  response.cookies.set(BUSINESS_SESSION_COOKIE, sessionToken, businessSessionCookieOptions(expiresAt));
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
