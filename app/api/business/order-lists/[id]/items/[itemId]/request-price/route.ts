import { NextResponse, type NextRequest } from "next/server";
import { isSameOriginMutation } from "@/lib/admin-request-security";
import { BUSINESS_SESSION_COOKIE, getBusinessPortalSession } from "@/lib/business-portal";
import { requestBusinessOrderListItemPrice } from "@/lib/business-order-list-price-request";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; itemId: string }> }
) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  const session = await getBusinessPortalSession(request.cookies.get(BUSINESS_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { id, itemId } = await context.params;
  const result = await requestBusinessOrderListItemPrice(session.businessAccountId, id, itemId);
  if (!result.ok) {
    const status = result.error === "NOT_FOUND" ? 404 : 409;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true, requestedAt: result.requestedAt });
}
