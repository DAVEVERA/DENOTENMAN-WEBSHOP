import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncOrderPaymentStatus } from "@/lib/orders";
import { syncOrderRefundStatuses } from "@/lib/order-refund-service";

/**
 * Mollie calls this with the payment id whenever a payment's status changes.
 * We deliberately ignore any status embedded in the request itself — a
 * webhook body is not authenticated, so anyone could POST a fake "paid"
 * notification. The id is only used to look the payment up ourselves via
 * syncOrderPaymentStatus, which re-fetches from Mollie with our secret key.
 */
export async function POST(request: NextRequest) {
  let paymentId: string | undefined;

  const contentType = request.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("application/json")) {
      const body = await request.json();
      paymentId = typeof body?.id === "string" ? body.id : undefined;
    } else {
      const form = await request.formData();
      const id = form.get("id");
      paymentId = typeof id === "string" ? id : undefined;
    }
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
  }

  if (!paymentId) {
    return NextResponse.json({ error: "Missing payment id" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({ where: { molliePaymentId: paymentId } });

  if (!order) {
    // Unknown payment id: acknowledge so Mollie stops retrying, nothing to do.
    return NextResponse.json({ received: true });
  }

  try {
    await syncOrderPaymentStatus(order);
    await syncOrderRefundStatuses(order.id);
  } catch (error) {
    console.error("Failed to sync order payment status from webhook", error);
    return NextResponse.json({ error: "SYNC_FAILED" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
