import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isSameOriginMutation } from "@/lib/admin-request-security";
import {
  acceptBusinessInvitation,
  BUSINESS_SESSION_COOKIE,
  BUSINESS_SESSION_TTL_SECONDS,
  BusinessPortalError,
} from "@/lib/business-portal";

export const runtime = "nodejs";

const schema = z.object({ token: z.string().min(32).max(200) }).strict();

export async function POST(request: NextRequest) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVITATION_INVALID" }, { status: 400 });

  try {
    const accepted = await acceptBusinessInvitation(parsed.data.token);
    const response = NextResponse.json({ ok: true, companyName: accepted.account.companyName });
    response.cookies.set(BUSINESS_SESSION_COOKIE, accepted.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: BUSINESS_SESSION_TTL_SECONDS,
      expires: accepted.expiresAt,
      priority: "high",
    });
    return response;
  } catch (error) {
    if (error instanceof BusinessPortalError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: 410 });
    }
    console.error("Failed to accept business invitation", error);
    return NextResponse.json({ error: "LOGIN_FAILED" }, { status: 500 });
  }
}
