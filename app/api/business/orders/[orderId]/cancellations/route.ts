import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { isSameOriginMutation } from "@/lib/admin-request-security";
import { BUSINESS_SESSION_COOKIE, getBusinessPortalSession, recordBusinessEvent } from "@/lib/business-portal";
import { prisma } from "@/lib/prisma";

const inputSchema = z.object({
  reason: z.string().trim().max(1_000).nullable().optional(),
  items: z.array(z.object({
    orderItemId: z.string().trim().min(1).max(100),
    quantity: z.number().int().min(1).max(100_000),
  }).strict()).min(1).max(200),
}).strict();

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  const session = await getBusinessPortalSession(request.cookies.get(BUSINESS_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION_ERROR" }, { status: 400 });

  const { orderId } = await context.params;
  const submittedIds = parsed.data.items.map((item) => item.orderItemId);
  if (new Set(submittedIds).size !== submittedIds.length) {
    return NextResponse.json({ error: "DUPLICATE_ITEM" }, { status: 400 });
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const order = await tx.order.findFirst({
          where: {
            id: orderId,
            businessOrderList: { businessAccountId: session.businessAccountId },
          },
          include: {
            items: true,
            businessOrderList: true,
            businessCancellationRequests: {
              where: { status: { in: ["PENDING", "PROCESSED"] } },
              include: { items: true },
            },
          },
        });
        if (!order || !order.businessOrderList) return { error: "NOT_FOUND" as const };
        if (!["PAID", "FULFILLED"].includes(order.status)) return { error: "ORDER_NOT_CANCELLABLE" as const };

        const requestedByItem = new Map<string, number>();
        for (const cancellation of order.businessCancellationRequests) {
          for (const item of cancellation.items) {
            requestedByItem.set(item.orderItemId, (requestedByItem.get(item.orderItemId) ?? 0) + item.quantity);
          }
        }
        const orderItemById = new Map(order.items.map((item) => [item.id, item]));
        for (const item of parsed.data.items) {
          const orderItem = orderItemById.get(item.orderItemId);
          const remaining = orderItem ? orderItem.quantity - (requestedByItem.get(item.orderItemId) ?? 0) : 0;
          if (!orderItem || item.quantity > remaining) {
            return { error: "QUANTITY_EXCEEDS_REMAINING" as const, orderItemId: item.orderItemId, remaining };
          }
        }

        const cancellation = await tx.businessOrderCancellationRequest.create({
          data: {
            businessAccountId: session.businessAccountId,
            orderListId: order.businessOrderList.id,
            orderId: order.id,
            reason: parsed.data.reason?.trim() || null,
            items: { create: parsed.data.items },
          },
          include: { items: true },
        });
        const totalQuantity = parsed.data.items.reduce((sum, item) => sum + item.quantity, 0);
        await recordBusinessEvent(tx, {
          businessAccountId: session.businessAccountId,
          orderListId: order.businessOrderList.id,
          type: "ORDER_CANCELLATION_REQUESTED",
          actorType: "CUSTOMER",
          actorName: session.businessAccount.contactName,
          summary: `${session.businessAccount.contactName} vraagt annulering aan voor ${totalQuantity} artikel(en) uit bestelling ${order.id}`,
          metadata: { cancellationRequestId: cancellation.id, orderId: order.id },
        });
        return { cancellation };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      if ("error" in result) {
        const status = result.error === "NOT_FOUND" ? 404 : 409;
        return NextResponse.json(result, { status });
      }
      return NextResponse.json({ ok: true, cancellation: result.cancellation }, { status: 201 });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034" && attempt < 2) continue;
      throw error;
    }
  }

  return NextResponse.json({ error: "CONFLICT_RETRY_EXHAUSTED" }, { status: 409 });
}
