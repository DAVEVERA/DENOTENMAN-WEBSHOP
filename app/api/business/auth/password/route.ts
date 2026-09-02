import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isSameOriginMutation } from "@/lib/admin-request-security";
import { getBusinessPortalSession } from "@/lib/business-portal";
import { isValidBusinessPassword, setBusinessAccountPassword } from "@/lib/business-password-auth";

export const runtime = "nodejs";

const schema = z.object({ password: z.string().min(8).max(200) }).strict();

export async function PUT(request: NextRequest) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  const session = await getBusinessPortalSession();
  if (!session) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !isValidBusinessPassword(parsed.data.password)) {
    return NextResponse.json({ error: "INVALID_PASSWORD" }, { status: 400 });
  }

  try {
    await setBusinessAccountPassword(session.businessAccountId, parsed.data.password);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to set business account password", { businessAccountId: session.businessAccountId, error });
    return NextResponse.json({ error: "PASSWORD_SET_FAILED" }, { status: 500 });
  }
}
