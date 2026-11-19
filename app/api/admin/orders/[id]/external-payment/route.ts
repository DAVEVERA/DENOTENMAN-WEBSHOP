import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin-api-auth";
import { isSameOriginMutation } from "@/lib/admin-request-security";
import { recordAudit } from "@/lib/admin-audit";
import { can } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { prepareAftersalesEvent, processAftersalesDelivery, queueAftersalesEvent } from "@/lib/aftersales/service";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!can(admin.role, "orders", "write")) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  const { id } = await params;
  const prepared = await prepareAftersalesEvent("ORDER_PAID");
  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id }, select: { id: true, origin: true, status: true, totalCents: true } });
    if (!order || order.origin !== "MANUAL" || order.status !== "PENDING") return null;
    const now = new Date();
    const updated = await tx.order.updateMany({ where: { id, status: "PENDING", origin: "MANUAL" }, data: { status: "PAID", paidAt: now, externallyPaidAt: now } });
    if (updated.count !== 1) return null;
    const queued = prepared ? await queueAftersalesEvent(tx, id, "ORDER_PAID", prepared) : null;
    await recordAudit(tx, admin, "Order", id, "UPDATE", { status: "PENDING" }, { status: "PAID", externallyPaidAt: now.toISOString(), totalCents: order.totalCents });
    return { id, deliveryId: queued?.deliveryId ?? null };
  });
  if (result?.deliveryId) await processAftersalesDelivery(result.deliveryId).catch((error) => console.error("Manual order confirmation failed", { orderId: id, error }));
  return result ? NextResponse.json(result) : NextResponse.json({ error: "NOT_PENDING_MANUAL_ORDER" }, { status: 409 });
}
