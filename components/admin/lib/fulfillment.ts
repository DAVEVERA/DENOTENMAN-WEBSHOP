import "server-only";
import { createAdminSupabaseClient } from "./supabase/server";

export async function listShipmentLabels() {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("shipment_labels")
    .select("id,order_id,provider,label_url,label_format,status,created_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    orderId: row.order_id ? String(row.order_id) : null,
    provider: String(row.provider ?? "postnl"),
    labelUrl: row.label_url ?? null,
    labelFormat: String(row.label_format ?? "pdf"),
    status: String(row.status ?? "draft"),
    createdAt: row.created_at ?? null,
  }));
}

export async function listReturns() {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("returns")
    .select("id,order_id,status,reason,customer_email,created_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    orderId: row.order_id ? String(row.order_id) : null,
    status: String(row.status ?? "requested"),
    reason: row.reason ?? null,
    customerEmail: row.customer_email ?? null,
    createdAt: row.created_at ?? null,
  }));
}

export async function listRefundRequests() {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("refund_requests")
    .select("id,order_id,provider,amount_cents,reason,status,provider_refund_id,created_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    orderId: row.order_id ? String(row.order_id) : null,
    provider: String(row.provider ?? "mollie"),
    amountCents: Number(row.amount_cents ?? 0),
    reason: row.reason ?? null,
    status: String(row.status ?? "draft"),
    providerRefundId: row.provider_refund_id ?? null,
    createdAt: row.created_at ?? null,
  }));
}
