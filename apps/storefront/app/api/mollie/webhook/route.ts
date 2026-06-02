import { handleMollieWebhook, shouldUpdatePaymentStatus } from "@denotenman/mollie";
import { createStorefrontServiceClient } from "../../../../lib/supabase/server";

export async function POST(request: Request) {
  const formData = await request.formData();
  const paymentId = String(formData.get("id") ?? "").trim();

  if (!paymentId) {
    return Response.json({ ok: false, error: "Missing payment id." }, { status: 400 });
  }

  const apiKey = process.env.MOLLIE_API_KEY;

  if (!apiKey) {
    return Response.json({ ok: false, error: "Mollie is not configured." }, { status: 500 });
  }

  const result = await handleMollieWebhook({ apiKey }, paymentId);
  const supabase = createStorefrontServiceClient();
  const { data: payment, error: paymentLookupError } = await supabase
    .from("payments")
    .select("id,order_id,status")
    .eq("provider", "mollie")
    .eq("provider_payment_id", result.providerPaymentId)
    .maybeSingle();

  if (paymentLookupError) {
    throw new Error(paymentLookupError.message);
  }

  if (!payment) {
    return Response.json({ ok: true, ignored: true });
  }

  if (!shouldUpdatePaymentStatus(payment.status, result.paymentStatus)) {
    return Response.json({
      ok: true,
      idempotent: true,
      status: payment.status,
    });
  }

  const { error: paymentUpdateError } = await supabase
    .from("payments")
    .update({
      status: result.paymentStatus,
      raw_payload: result.payment,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payment.id);

  if (paymentUpdateError) {
    throw new Error(paymentUpdateError.message);
  }

  const { error: orderUpdateError } = await supabase
    .from("orders")
    .update({
      status: result.orderStatus,
      payment_status: result.paymentStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payment.order_id);

  if (orderUpdateError) {
    throw new Error(orderUpdateError.message);
  }

  return Response.json({ ok: true });
}
