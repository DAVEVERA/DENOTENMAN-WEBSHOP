import { NextResponse, type NextRequest } from "next/server";
import { isSameOriginMutation } from "@/lib/admin-request-security";
import { BUSINESS_SESSION_COOKIE, getBusinessPortalSession } from "@/lib/business-portal";
import { createBusinessOrderListCheckout } from "@/lib/business-order-checkout";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  const session = await getBusinessPortalSession(request.cookies.get(BUSINESS_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { id } = await context.params;
  const result = await createBusinessOrderListCheckout(session.businessAccountId, id);
  if (!result.ok) {
    const status = result.error === "NOT_FOUND"
      ? 404
      : result.error === "ORDER_LIST_EXPIRED"
        ? 410
        : result.error === "PAYMENT_CREATE_FAILED"
          ? 502
          : result.error === "EMPTY_ORDER"
            ? 400
            : 409;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true, checkoutUrl: result.checkoutUrl });
}
