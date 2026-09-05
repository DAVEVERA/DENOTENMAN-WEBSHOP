import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isSameOriginMutation } from "@/lib/admin-request-security";
import { BUSINESS_SESSION_COOKIE, getBusinessPortalSession } from "@/lib/business-portal";
import { setBusinessOrderListPickupDay } from "@/lib/business-order-list-pickup-day";

export const runtime = "nodejs";

const bodySchema = z.object({ pickupDay: z.string().datetime().nullable() }).strict();

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  const session = await getBusinessPortalSession(request.cookies.get(BUSINESS_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION_ERROR" }, { status: 400 });

  const { id } = await context.params;
  const result = await setBusinessOrderListPickupDay(
    session.businessAccountId,
    id,
    parsed.data.pickupDay ? new Date(parsed.data.pickupDay) : null
  );
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.error === "NOT_FOUND" ? 404 : 409 },
    );
  }

  return NextResponse.json({ ok: true, pickupDay: result.pickupDay });
}
