import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isSameOriginMutation } from "@/lib/admin-request-security";
import { prisma } from "@/lib/prisma";
import { BUSINESS_SESSION_COOKIE, createBusinessSession, claimBusinessPasswordLoginAllowance } from "@/lib/business-portal";
import { businessSessionCookieOptions } from "@/lib/business-portal-contract";
import { verifyBusinessPasswordLogin } from "@/lib/business-password-auth";

export const runtime = "nodejs";
const schema = z.object({ email: z.string().trim().email().max(320), password: z.string().min(1).max(200) }).strict();

function clientAddress(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  // Cloud Run appends the real client and load-balancer addresses. Using the
  // penultimate value prevents a caller-supplied leftmost value from becoming
  // an easy rate-limit bypass.
  if (forwarded?.length) return forwarded.length >= 2 ? forwarded.at(-2)! : forwarded[0];
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function POST(request: NextRequest) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 400 });

  const allowed = await claimBusinessPasswordLoginAllowance(clientAddress(request), parsed.data.email);
  if (!allowed) return NextResponse.json({ error: "TOO_MANY_ATTEMPTS" }, { status: 429 });

  const account = await verifyBusinessPasswordLogin(parsed.data.email, parsed.data.password);
  if (!account) return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });

  const { sessionToken, expiresAt } = await prisma.$transaction((tx) =>
    createBusinessSession(tx, { businessAccountId: account.id, contactName: account.contactName, via: "wachtwoord" })
  );

  const response = NextResponse.json({ ok: true, companyName: account.companyName });
  response.cookies.set(BUSINESS_SESSION_COOKIE, sessionToken, businessSessionCookieOptions(expiresAt));
  return response;
}
