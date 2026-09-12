import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin-api-auth";
import { isSameOriginMutation } from "@/lib/admin-request-security";
import { prisma } from "@/lib/prisma";
import { generateInvoiceForOrder } from "@/lib/business-invoice";

export const runtime = "nodejs";

/**
 * Manually (re)creates the invoice for a paid business order, without
 * emailing it. generateInvoiceForOrder is idempotent (returns the existing
 * invoice if one is already there), so this is safe to click more than
 * once — it exists for the case where invoice generation silently failed
 * during checkout (e.g. a slow PDF render) and the order was left without
 * one. Deliberately does not use generateAndSendBusinessInvoice, which
 * would also re-email the customer and Fedor.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; orderId: string }> }
) {
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (admin.role === "STAFF") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  }

  const { id, orderId } = await context.params;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, businessOrderList: true },
  });
  if (!order || !order.businessOrderList || order.businessOrderList.businessAccountId !== id) {
    return NextResponse.json({ error: "ORDER_NOT_FOUND" }, { status: 404 });
  }
  if (order.status !== "PAID" && order.status !== "FULFILLED") {
    return NextResponse.json({ error: "ORDER_NOT_PAID" }, { status: 409 });
  }

  const businessAccount = await prisma.businessAccount.findUnique({ where: { id } });
  if (!businessAccount) return NextResponse.json({ error: "ACCOUNT_NOT_FOUND" }, { status: 404 });

  try {
    const invoice = await generateInvoiceForOrder(order, businessAccount);
    return NextResponse.json({ ok: true, invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber });
  } catch (error) {
    console.error(`Failed to regenerate invoice for order ${orderId}`, error);
    return NextResponse.json({ error: "INVOICE_GENERATION_FAILED" }, { status: 500 });
  }
}
