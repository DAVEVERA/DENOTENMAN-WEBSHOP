import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { getAdminSession } from "@/lib/admin-api-auth";
import { SOCIAL_STATE_COOKIE, socialRedirectUri } from "@/lib/social/http";
import { connectionByKey, connectionStatus } from "@/lib/social/providers";

export const runtime = "nodejs";
type Context = { params: Promise<{ provider: string }> };

// Starts the OAuth login at the platform. The state value ties the callback to this browser.
export async function GET(request: NextRequest, context: Context) {
  const channelsPage = new URL("/admin/marketing/social/kanalen", request.nextUrl.origin);
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.redirect(new URL("/admin/login", request.nextUrl.origin));
  if (admin.role !== "OWNER" && admin.role !== "ADMIN") {
    channelsPage.searchParams.set("fout", "Alleen een owner of admin kan kanalen koppelen.");
    return NextResponse.redirect(channelsPage);
  }
  const connection = connectionByKey((await context.params).provider);
  if (!connection) return NextResponse.redirect(channelsPage);
  if (!connectionStatus(connection).configured) {
    channelsPage.searchParams.set("fout", `${connection.label} is nog niet ingesteld op de server.`);
    return NextResponse.redirect(channelsPage);
  }
  const state = `${connection.key}.${randomBytes(24).toString("base64url")}`;
  const response = NextResponse.redirect(connection.authorizeUrl(state, socialRedirectUri(connection.key)));
  response.cookies.set({
    name: SOCIAL_STATE_COOKIE,
    value: `${state}.${admin.id}`,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/admin/social/callback",
    maxAge: 10 * 60,
  });
  return response;
}
