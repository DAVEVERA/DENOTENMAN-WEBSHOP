import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { defaultLocale, isLocale } from "@/lib/i18n";

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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
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
