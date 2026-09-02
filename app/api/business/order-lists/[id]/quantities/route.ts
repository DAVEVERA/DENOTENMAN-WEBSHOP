import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isSameOriginMutation } from "@/lib/admin-request-security";
import { BUSINESS_SESSION_COOKIE, getBusinessPortalSession } from "@/lib/business-portal";
import { updateBusinessOrderListQuantities } from "@/lib/business-order-list-quantities";

export const runtime = "nodejs";

const schema = z.object({
  version: z.number().int().min(1),
  quantities: z.array(z.object({
    itemId: z.string().trim().min(1).max(100),
    quantity: z.number().int().min(0).max(100_000),
  })).min(1).max(200),
}).strict();

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  const session = await getBusinessPortalSession(request.cookies.get(BUSINESS_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION_ERROR" }, { status: 400 });

  const { id } = await context.params;
  const result = await updateBusinessOrderListQuantities(
    session.businessAccountId,
    id,
    parsed.data.version,
    parsed.data.quantities
  );
  if (!result.ok) {
    const status = result.error === "NOT_FOUND"
      ? 404
      : result.error === "ORDER_LIST_EXPIRED"
        ? 410
        : result.error === "VERSION_CONFLICT" || result.error === "CHECKOUT_IN_PROGRESS" || result.error === "ITEM_MISMATCH"
          ? 409
          : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true, orderList: result.orderList });
}
