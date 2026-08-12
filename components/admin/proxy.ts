import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "denotenman_admin_session";
const MIN_ADMIN_SESSION_SECRET_LENGTH = 32;
const PUBLIC_FILE_PATTERN = /\.(?:avif|gif|ico|jpg|jpeg|png|svg|webp)$/i;
const UNSAFE_PRODUCTION_MARKERS = [
  "changeme",
  "change-me",
  "demo",
  "example",
  "local",
  "placeholder",
  "rotate-before-production",
  "test",
];

function base64UrlToText(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  return atob(padded);
}

async function signPayload(payload: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const bytes = Array.from(new Uint8Array(signature));
  const binary = bytes.map((byte) => String.fromCharCode(byte)).join("");

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function hasUnsafeProductionMarker(value: string) {
  const normalizedValue = value.toLowerCase();
  return UNSAFE_PRODUCTION_MARKERS.some((marker) => normalizedValue.includes(marker));
}

function hasValidSessionSecret(secret?: string) {
  if (!secret) {
    return false;
  }

  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  return secret.length >= MIN_ADMIN_SESSION_SECRET_LENGTH && !hasUnsafeProductionMarker(secret);
}

function getValidSessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  return hasValidSessionSecret(secret) ? secret : null;
}

async function hasValidSession(request: NextRequest) {
  const secret = getValidSessionSecret();
  const token = request.cookies.get(SESSION_COOKIE)?.value;

  if (!secret || !token) {
    return false;
  }

  const [payload, signature] = token.split(".");

  if (!payload || !signature || signature !== (await signPayload(payload, secret))) {
    return false;
  }

  try {
    const session = JSON.parse(base64UrlToText(payload)) as { exp?: number };
    return typeof session.exp === "number" && session.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    PUBLIC_FILE_PATTERN.test(pathname)
  ) {
    return NextResponse.next();
  }

  if (await hasValidSession(request)) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:avif|gif|ico|jpg|jpeg|png|svg|webp)$).*)"],
};
