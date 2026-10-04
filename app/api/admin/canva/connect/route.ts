import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { getAdminSession } from "@/lib/admin-api-auth";
import { buildAuthorizeUrl, createPkcePair } from "@/lib/canva/api";
import { CANVA_CALLBACK_PATH, canvaConfig } from "@/lib/canva/config";
import { CANVA_STATE_COOKIE } from "@/lib/canva/http";
import { safeAdminPath } from "@/lib/canva/return-token";
import { BASE_URL } from "@/lib/routes";
import { sealWithPurpose } from "@/lib/secret-box";

export const runtime = "nodejs";
// Redirects use SITE_URL: behind Cloud Run, request.nextUrl.origin is the container address (0.0.0.0:8080).

// Starts the Canva login (OAuth 2.0 with PKCE). The sealed cookie ties the callback to this admin.
export async function GET(request: NextRequest) {
  const returnTo = safeAdminPath(request.nextUrl.searchParams.get("returnTo") ?? "/admin/instellingen/integraties");
  const back = new URL(returnTo, BASE_URL);
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.redirect(new URL("/admin/login", BASE_URL));
  if (admin.role !== "OWNER" && admin.role !== "ADMIN") {
    back.searchParams.set("canva", "Alleen een owner of admin kan Canva koppelen.");
    return NextResponse.redirect(back);
  }
  const config = canvaConfig();
  if (!config) {
    back.searchParams.set("canva", "Canva is nog niet ingesteld op de server (CANVA_CLIENT_ID en CANVA_CLIENT_SECRET).");
    return NextResponse.redirect(back);
  }
  const state = randomBytes(32).toString("base64url");
  const { verifier, challenge } = createPkcePair();
  const response = NextResponse.redirect(buildAuthorizeUrl(config, state, challenge));
  response.cookies.set({
    name: CANVA_STATE_COOKIE,
    value: sealWithPurpose(JSON.stringify({ state, verifier, adminId: admin.id, returnTo, expiresAt: Date.now() + 15 * 60 * 1000 }), "canva-oauth-state"),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: CANVA_CALLBACK_PATH,
    maxAge: 15 * 60,
  });
  return response;
}
