import { NextResponse, type NextRequest } from "next/server";
import { isSameOriginMutation } from "@/lib/admin-request-security";
import { BUSINESS_SESSION_COOKIE, revokeBusinessSession } from "@/lib/business-portal";

export async function POST(request: NextRequest) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  await revokeBusinessSession(request.cookies.get(BUSINESS_SESSION_COOKIE)?.value);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(BUSINESS_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
