import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-api-auth";
import { isSameOriginMutation } from "@/lib/admin-request-security";
import { recordBusinessEvent } from "@/lib/business-portal";
import { recordAudit } from "@/lib/admin-audit";
import { businessOrderListItemInputSchema, resolveBusinessOrderListItems } from "@/lib/business-order-list-items";

const inputSchema = z.object({
  title: z.string().trim().min(1).max(160),
  validUntil: z.string().datetime().nullable().optional(),
  items: z.array(businessOrderListItemInputSchema).min(1).max(200),
}).strict();

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (admin.role === "STAFF") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() }, { status: 400 });

  const { id } = await context.params;
  const validUntil = parsed.data.validUntil ? new Date(parsed.data.validUntil) : null;
  if (validUntil && validUntil.getTime() <= Date.now()) {
    return NextResponse.json({ error: "VALID_UNTIL_IN_PAST" }, { status: 400 });
  }
  const account = await prisma.businessAccount.findUnique({ where: { id } });
  if (!account) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (account.status !== "APPROVED") return NextResponse.json({ error: "ACCOUNT_NOT_APPROVED" }, { status: 409 });

  const resolved = await resolveBusinessOrderListItems(parsed.data.items);
  if (!resolved.ok) {
    const status = resolved.error === "TOTAL_OUT_OF_RANGE" ? 400 : resolved.error === "DUPLICATE_VARIANT" ? 400 : 409;
    return NextResponse.json({ error: resolved.error }, { status });
  }

  const created = await prisma.$transaction(async (tx) => {
    const orderList = await tx.businessOrderList.create({
      data: {
        businessAccountId: id,
        title: parsed.data.title,
        totalCents: resolved.totalCents,
        validUntil,
        createdByAdminId: admin.id,
        items: {
          create: resolved.items.map((item, index) => ({ ...item, sortOrder: index })),
        },
      },
      include: { items: true },
    });
    await recordBusinessEvent(tx, {
      businessAccountId: id,
      orderListId: orderList.id,
      type: "ORDER_LIST_CREATED",
      actorType: "ADMIN",
      actorName: admin.name,
      summary: `Bestellijst “${orderList.title}” aangemaakt`,
    });
    await recordAudit(tx, admin, "BusinessOrderList", orderList.id, "CREATE", null, orderList);
    return orderList;
  });

  return NextResponse.json({ ok: true, orderList: created }, { status: 201 });
}
