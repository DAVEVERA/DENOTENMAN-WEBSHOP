import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { defaultLocale, isLocale } from "@/lib/i18n";
import { PREVIEW_COOKIE, comingSoonHtml, isComingSoonEnabled, previewToken } from "@/lib/comingSoon";
import { ADMIN_SESSION_COOKIE, isValidAdminSessionToken } from "@/lib/admin-auth";

function detectLocaleFromHeader(acceptLanguage: string | null): string {
  if (!acceptLanguage) {
    return defaultLocale;
  }

  const preferred = acceptLanguage
    .split(",")
    .map((part) => part.split(";")[0]?.trim().slice(0, 2).toLowerCase())
    .find((lang) => lang && isLocale(lang));

  return preferred ?? defaultLocale;
}

function checkComingSoonGate(request: NextRequest): NextResponse | null {
  if (!isComingSoonEnabled()) return null;

  const token = previewToken();
  const queryToken = request.nextUrl.searchParams.get("preview");
  const hasValidCookie = token && request.cookies.get(PREVIEW_COOKIE)?.value === token;

  if (queryToken && token && queryToken === token) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.searchParams.delete("preview");
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set(PREVIEW_COOKIE, token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
    return response;
  }

  if (hasValidCookie) return null;

  return new NextResponse(comingSoonHtml(), {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

async function checkAdminGate(request: NextRequest): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl;

  if (pathname === "/admin/login") {
    return null;
  }

  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;

  if (await isValidAdminSessionToken(token)) {
    return null;
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/admin/login";
  loginUrl.search = "";
  return NextResponse.redirect(loginUrl);
}

export default async function proxy(request: NextRequest) {
  const gated = checkComingSoonGate(request);
  if (gated) return gated;

  const { pathname } = request.nextUrl;

  // The admin area is Dutch-only tooling, not part of the public [locale]
  // route tree — skip locale detection/redirects and gate it on its own
  // session cookie instead.
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return (await checkAdminGate(request)) ?? NextResponse.next();
  }

  const segments = pathname.split("/");
  const firstSegment = segments[1];

  if (firstSegment && isLocale(firstSegment)) {
    return NextResponse.next();
  }

  const locale = detectLocaleFromHeader(request.headers.get("accept-language"));

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;

  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
