import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-api-auth";
import { isSameOriginMutation } from "@/lib/admin-request-security";
import { recordAudit } from "@/lib/admin-audit";
import { recordBusinessEvent, sendBusinessOrderListChangedEmail, sendBusinessOrderListEmail } from "@/lib/business-portal";
import { getMollieClient } from "@/lib/mollie";

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
  if (action === "SEND" && existing.validUntil && existing.validUntil.getTime() <= Date.now()) {
    return NextResponse.json({ error: "ORDER_LIST_EXPIRED" }, { status: 410 });
  }
  if (action === "CANCEL") {
    const pendingOrder = await prisma.order.findFirst({
      where: { businessOrderListId: orderListId, status: "PENDING" },
    });
    if (!pendingOrder) return NextResponse.json({ error: "NO_ACTIVE_ORDER" }, { status: 409 });

    if (pendingOrder.molliePaymentId) {
      try {
        const payment = await getMollieClient().payments.get(pendingOrder.molliePaymentId);
        if (payment.status === "paid") {
          return NextResponse.json({ error: "ORDER_ALREADY_PAID" }, { status: 409 });
        }
        if (!["canceled", "expired", "failed"].includes(payment.status)) {
          await getMollieClient().payments.cancel(pendingOrder.molliePaymentId);
        }
      } catch (error) {
        console.error("Could not safely cancel business payment", { orderId: pendingOrder.id, error });
        return NextResponse.json({ error: "PAYMENT_CANCEL_FAILED" }, { status: 502 });
      }
    }

    try {
      const cancelled = await prisma.$transaction(async (tx) => {
        const claimed = await tx.order.updateMany({
          where: { id: pendingOrder.id, status: "PENDING" },
          data: { status: "CANCELLED" },
        });
        if (claimed.count !== 1) throw new BusinessOrderListTransitionError();
        const order = await tx.order.findUniqueOrThrow({ where: { id: pendingOrder.id } });
        await recordBusinessEvent(tx, {
          businessAccountId: id,
          orderListId,
          type: "ORDER_LIST_CANCELLED",
          actorType: "ADMIN",
          actorName: admin.name,
          summary: `Huidige bestelling van bestellijst “${existing.title}” geannuleerd; de vaste lijst blijft actief`,
        });
        await recordAudit(tx, admin, "Order", order.id, "UPDATE", pendingOrder, order);
        return order;
      });
      return NextResponse.json({ ok: true, order: cancelled, orderListUnchanged: true });
    } catch (error) {
      if (error instanceof BusinessOrderListTransitionError) {
        return NextResponse.json({ error: "ORDER_ALREADY_SETTLED" }, { status: 409 });
      }
      throw error;
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
        data: { status: "SENT", sentAt: new Date(), deliveryStatus: "PENDING", deliveryError: null, version: { increment: 1 } },
      });
      if (claimed.count !== 1) throw new BusinessOrderListTransitionError();
      const orderList = await tx.businessOrderList.findUniqueOrThrow({ where: { id: existing.id } });
      await recordBusinessEvent(tx, {
        businessAccountId: id,
        orderListId,
        type: "ORDER_LIST_SENT",
        actorType: "ADMIN",
        actorName: admin.name,
        summary: `Bestellijst “${existing.title}” bewust naar de klant verstuurd`,
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
    // "Wijzigingen naar klant sturen" (BusinessOrderListActions.tsx) hits this
    // same SEND action for both a genuine first send and a re-send after
    // items/route.ts marked the list CHANGES_PENDING. Capture which one this
    // is before the transaction below overwrites deliveryStatus.
    const isChangeNotification = existing.deliveryStatus === "CHANGES_PENDING";

    // Only an explicit SEND enters this delivery claim. Saving list changes
    // never invokes the mail provider, and every send receives a new version.
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
      delivery = isChangeNotification
        ? await sendBusinessOrderListChangedEmail({
            orderListId,
            version: updated.version,
            title: existing.title,
            items: existing.items,
            totalCents: existing.totalCents,
            account: existing.businessAccount,
          })
        : await sendBusinessOrderListEmail({
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
