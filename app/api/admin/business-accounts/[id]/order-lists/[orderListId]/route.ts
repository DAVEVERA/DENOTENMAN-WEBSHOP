import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-api-auth";
import { isSameOriginMutation } from "@/lib/admin-request-security";
import { recordAudit } from "@/lib/admin-audit";
import { recordBusinessEvent, sendBusinessOrderListEmail } from "@/lib/business-portal";

const schema = z.object({ action: z.enum(["SEND", "CANCEL", "CONFIRM_DELIVERED", "CONFIRM_FAILED"]) }).strict();
const STALE_DELIVERY_CLAIM_MS = 5 * 60 * 1000;

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; orderListId: string }> }
) {
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (admin.role === "STAFF") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION_ERROR" }, { status: 400 });
  const { id, orderListId } = await context.params;
  let existing = await prisma.businessOrderList.findFirst({
    where: { id: orderListId, businessAccountId: id },
    include: { businessAccount: true, items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!existing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const action = parsed.data.action;
  const staleDeliveryClaim = existing.deliveryStatus === "SENDING"
    && existing.updatedAt.getTime() <= Date.now() - STALE_DELIVERY_CLAIM_MS;

  if (staleDeliveryClaim) {
    const deliveryLog = await prisma.emailDeliveryLog.findUnique({
      where: { idempotencyKey: `business-order-list:${orderListId}:sent:${existing.version}` },
      select: { status: true, providerMessageId: true, errorMessage: true },
    });
    if (deliveryLog?.status === "ACCEPTED" || deliveryLog?.status === "DELIVERED") {
      await prisma.businessOrderList.updateMany({
        where: { id: orderListId, businessAccountId: id, version: existing.version, deliveryStatus: "SENDING" },
        data: { deliveryStatus: "ACCEPTED", providerMessageId: deliveryLog.providerMessageId, deliveryError: null },
      });
      return NextResponse.json({ ok: true, recovered: "DELIVERY_CONFIRMED" });
    }
    const recoveredStatus = !deliveryLog || deliveryLog.status === "FAILED" ? "FAILED" : "UNKNOWN";
    await prisma.businessOrderList.updateMany({
      where: { id: orderListId, businessAccountId: id, version: existing.version, deliveryStatus: "SENDING" },
      data: {
        deliveryStatus: recoveredStatus,
        deliveryError: recoveredStatus === "UNKNOWN"
          ? "Providerstatus is onzeker na een onderbroken verzending; handmatige controle vereist."
          : deliveryLog?.errorMessage?.slice(0, 2000) ?? "Verzending stopte voordat de provider werd aangeroepen.",
      },
    });
    existing = await prisma.businessOrderList.findFirst({
      where: { id: orderListId, businessAccountId: id },
      include: { businessAccount: true, items: { orderBy: { sortOrder: "asc" } } },
    });
    if (!existing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  if (action === "CONFIRM_DELIVERED" || action === "CONFIRM_FAILED") {
    if (existing.deliveryStatus !== "UNKNOWN") return NextResponse.json({ error: "INVALID_STATUS_TRANSITION" }, { status: 409 });
    const resolvedStatus = action === "CONFIRM_DELIVERED" ? "ACCEPTED" : "FAILED";
    const resolved = await prisma.businessOrderList.updateMany({
      where: { id: orderListId, businessAccountId: id, version: existing.version, deliveryStatus: "UNKNOWN" },
      data: { deliveryStatus: resolvedStatus, deliveryError: action === "CONFIRM_FAILED" ? "Fedor heeft gecontroleerd dat opnieuw verzenden veilig is." : null },
    });
    if (resolved.count !== 1) return NextResponse.json({ error: "VERSION_CONFLICT" }, { status: 409 });
    const orderList = await prisma.businessOrderList.findUniqueOrThrow({ where: { id: orderListId } });
    await recordAudit(prisma, admin, "BusinessOrderList", orderListId, "UPDATE", existing, orderList);
    return NextResponse.json({ ok: true, orderList });
  }
  const retryFailedDelivery = existing.status === "SENT" && existing.deliveryStatus === "FAILED";
  if (action === "SEND" && existing.validUntil && existing.validUntil.getTime() <= Date.now()) {
    return NextResponse.json({ error: "ORDER_LIST_EXPIRED" }, { status: 410 });
  }
  if (action === "SEND" && !["DRAFT", "CHANGES_REQUESTED"].includes(existing.status) && !retryFailedDelivery) {
    return NextResponse.json({ error: "INVALID_STATUS_TRANSITION" }, { status: 409 });
  }
  if (action === "CANCEL" && existing.deliveryStatus === "SENDING") {
    return NextResponse.json({ error: "DELIVERY_IN_PROGRESS" }, { status: 409 });
  }
  if (action === "CANCEL" && existing.deliveryStatus === "UNKNOWN") {
    return NextResponse.json({ error: "DELIVERY_STATUS_UNKNOWN" }, { status: 409 });
  }
  if (action === "CANCEL" && ["APPROVED", "PAID", "CANCELLED"].includes(existing.status)) {
    return NextResponse.json({ error: "INVALID_STATUS_TRANSITION" }, { status: 409 });
  }
  if (action === "CANCEL") {
    const pendingOrder = await prisma.order.findFirst({ where: { businessOrderListId: orderListId, status: "PENDING" }, select: { id: true } });
    if (pendingOrder) {
      return NextResponse.json({ error: "CHECKOUT_IN_PROGRESS" }, { status: 409 });
    }
  }

  let updated;
  try {
    updated = await prisma.$transaction(async (tx) => {
      const claimed = await tx.businessOrderList.updateMany({
        where: {
          id: existing.id,
          businessAccountId: id,
          version: existing.version,
          status: existing.status,
          deliveryStatus: existing.deliveryStatus,
        },
        data: action === "SEND"
          ? { status: "SENT", sentAt: new Date(), deliveryStatus: "PENDING", deliveryError: null, version: { increment: 1 } }
          : { status: "CANCELLED", version: { increment: 1 } },
      });
      if (claimed.count !== 1) throw new BusinessOrderListTransitionError();
      const orderList = await tx.businessOrderList.findUniqueOrThrow({ where: { id: existing.id } });
      await recordBusinessEvent(tx, {
        businessAccountId: id,
        orderListId,
        type: action === "SEND" ? "ORDER_LIST_SENT" : "ORDER_LIST_CANCELLED",
        actorType: "ADMIN",
        actorName: admin.name,
        summary: action === "SEND" ? `Bestellijst “${existing.title}” verstuurd` : `Bestellijst “${existing.title}” geannuleerd`,
      });
      await recordAudit(tx, admin, "BusinessOrderList", orderListId, "UPDATE", existing, orderList);
      return orderList;
    });
  } catch (error) {
    if (error instanceof BusinessOrderListTransitionError) {
      return NextResponse.json({ error: "VERSION_CONFLICT" }, { status: 409 });
    }
    throw error;
  }

  if (action === "SEND") {
    // PENDING is the cancellation window. Whichever command atomically claims first wins:
    // CANCEL changes the list status/version, while SEND changes deliveryStatus to SENDING.
    // A list can therefore never become CANCELLED while its outbound mail is in flight.
    const deliveryClaim = await prisma.businessOrderList.updateMany({
      where: {
        id: orderListId,
        businessAccountId: id,
        version: updated.version,
        status: "SENT",
        deliveryStatus: "PENDING",
      },
      data: { deliveryStatus: "SENDING" },
    });
    if (deliveryClaim.count !== 1) {
      return NextResponse.json({ error: "DELIVERY_CLAIM_CONFLICT" }, { status: 409 });
    }

    let delivery;
    try {
      delivery = await sendBusinessOrderListEmail({
        orderListId,
        version: updated.version,
        title: existing.title,
        validUntil: existing.validUntil,
        items: existing.items,
        totalCents: existing.totalCents,
        account: existing.businessAccount,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Onbekende verzendfout";
      await prisma.businessOrderList.updateMany({
        where: { id: orderListId, businessAccountId: id, version: updated.version, status: "SENT", deliveryStatus: "SENDING" },
        data: { deliveryStatus: "FAILED", deliveryError: message.slice(0, 2000) },
      });
      console.error("Business order-list email failed before provider completion", { orderListId, error });
      return NextResponse.json({ ok: true, orderList: updated, warning: "ORDER_LIST_EMAIL_FAILED" }, { status: 202 });
    }
    if (delivery.status === "failed") {
      await prisma.businessOrderList.updateMany({
        where: { id: orderListId, businessAccountId: id, version: updated.version, status: "SENT", deliveryStatus: "SENDING" },
        data: { deliveryStatus: "FAILED", deliveryError: delivery.error.slice(0, 2000) },
      });
      return NextResponse.json({ ok: true, orderList: updated, warning: "ORDER_LIST_EMAIL_FAILED" }, { status: 202 });
    }
    if (delivery.status === "accepted") {
      await prisma.businessOrderList.updateMany({
        where: { id: orderListId, businessAccountId: id, version: updated.version, status: "SENT", deliveryStatus: "SENDING" },
        data: { deliveryStatus: "ACCEPTED", providerMessageId: delivery.providerMessageId, deliveryError: null },
      });
    }
  }
  return NextResponse.json({ ok: true, orderList: updated });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; orderListId: string }> }
) {
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (admin.role === "STAFF") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });

  const { id, orderListId } = await context.params;
  const existing = await prisma.businessOrderList.findFirst({ where: { id: orderListId, businessAccountId: id } });
  if (!existing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  // Only a never-sent concept can be truly deleted. Anything the customer may
  // have already seen (SENT or beyond) must be cancelled instead, so the
  // audit/event trail for that account keeps a record of it.
  if (existing.status !== "DRAFT") {
    return NextResponse.json({ error: "INVALID_STATUS_TRANSITION" }, { status: 409 });
  }

  await prisma.$transaction(async (tx) => {
    await recordAudit(tx, admin, "BusinessOrderList", orderListId, "DELETE", existing, null);
    await recordBusinessEvent(tx, {
      businessAccountId: id,
      type: "ORDER_LIST_DELETED",
      actorType: "ADMIN",
      actorName: admin.name,
      summary: `Concept-bestellijst “${existing.title}” verwijderd`,
    });
    await tx.businessOrderList.delete({ where: { id: orderListId } });
  });

  return NextResponse.json({ ok: true });
}

class BusinessOrderListTransitionError extends Error {}
