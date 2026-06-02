import "server-only";
import { createAdminSupabaseClient } from "./supabase/server";

export type AdminOrderStatus =
  | "pending"
  | "paid"
  | "processing"
  | "shipped"
  | "cancelled";

export type AdminPaymentStatus =
  | "draft"
  | "open"
  | "pending"
  | "authorized"
  | "paid"
  | "failed"
  | "cancelled"
  | "expired";

export type AdminOrderListItem = {
  id: string;
  orderNumber: string;
  customerEmail: string | null;
  customerName: string | null;
  status: string;
  paymentStatus: string;
  totalCents: number;
  createdAt: string | null;
  paymentProvider: string | null;
  providerPaymentId: string | null;
};

export type AdminOrderItem = {
  id: string;
  name: string;
  sku: string | null;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  image: string | null;
  metadata: Record<string, unknown>;
};

export type AdminOrderDetail = AdminOrderListItem & {
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  checkoutState: Record<string, unknown>;
  payments: Array<{
    id: string;
    provider: string;
    providerPaymentId: string | null;
    status: string;
    amountCents: number;
    checkoutUrl: string | null;
    createdAt: string | null;
    updatedAt: string | null;
  }>;
  items: AdminOrderItem[];
};

export function formatAdminMoney(cents: number | null | undefined) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format((cents ?? 0) / 100);
}

export function formatAdminDate(value: string | null | undefined) {
  if (!value) return "Onbekend";
  return new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function mapOrder(row: any): AdminOrderListItem {
  const payment = Array.isArray(row.payments) ? row.payments[0] : null;

  return {
    id: String(row.id),
    orderNumber: String(row.order_number ?? row.id),
    customerEmail: row.customer_email ?? null,
    customerName: row.customer_name ?? null,
    status: String(row.status ?? "pending"),
    paymentStatus: String(row.payment_status ?? payment?.status ?? "draft"),
    totalCents: Number(row.total_cents ?? row.amount_total ?? payment?.amount_cents ?? 0),
    createdAt: row.created_at ?? null,
    paymentProvider: payment?.provider ?? null,
    providerPaymentId: payment?.provider_payment_id ?? null,
  };
}

function mapOrderDetail(row: any): AdminOrderDetail {
  return {
    ...mapOrder(row),
    subtotalCents: Number(row.subtotal_cents ?? 0),
    shippingCents: Number(row.shipping_cents ?? 0),
    taxCents: Number(row.tax_cents ?? 0),
    checkoutState: row.checkout_state ?? {},
    payments: Array.isArray(row.payments)
      ? row.payments.map((payment: any) => ({
          id: String(payment.id),
          provider: String(payment.provider ?? "mollie"),
          providerPaymentId: payment.provider_payment_id ?? null,
          status: String(payment.status ?? "draft"),
          amountCents: Number(payment.amount_cents ?? 0),
          checkoutUrl: payment.checkout_url ?? null,
          createdAt: payment.created_at ?? null,
          updatedAt: payment.updated_at ?? null,
        }))
      : [],
    items: Array.isArray(row.order_items)
      ? row.order_items.map((item: any) => ({
          id: String(item.id),
          name: String(item.name ?? "Onbekend product"),
          sku: item.sku ?? null,
          quantity: Number(item.quantity ?? 0),
          unitPriceCents: Number(item.unit_price_cents ?? 0),
          lineTotalCents: Number(item.line_total_cents ?? 0),
          image: item.image ?? null,
          metadata: item.metadata ?? {},
        }))
      : [],
  };
}

export async function listAdminOrders(limit = 100) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id,order_number,customer_email,customer_name,status,payment_status,total_cents,amount_total,created_at,payments(provider,provider_payment_id,status,amount_cents)",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapOrder);
}

export async function getAdminOrder(id: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id,order_number,customer_email,customer_name,status,payment_status,total_cents,amount_total,subtotal_cents,shipping_cents,tax_cents,checkout_state,created_at,payments(id,provider,provider_payment_id,status,amount_cents,checkout_url,created_at,updated_at),order_items(id,name,sku,quantity,unit_price_cents,line_total_cents,image,metadata)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapOrderDetail(data) : null;
}

export async function updateAdminOrderStatus(input: {
  orderId: string;
  status: AdminOrderStatus;
  paymentStatus?: AdminPaymentStatus;
}) {
  const supabase = createAdminSupabaseClient();
  const patch: Record<string, unknown> = {
    status: input.status,
    updated_at: new Date().toISOString(),
  };

  if (input.paymentStatus) {
    patch.payment_status = input.paymentStatus;
  }

  const { error } = await supabase.from("orders").update(patch).eq("id", input.orderId);
  if (error) throw new Error(error.message);
}

export async function listAdminPayments(limit = 100) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("payments")
    .select(
      "id,order_id,provider,provider_payment_id,status,amount_cents,currency,checkout_url,created_at,updated_at,orders(order_number,customer_email,customer_name,status)",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    orderId: String(row.order_id),
    orderNumber: String(row.orders?.order_number ?? row.order_id),
    customer: row.orders?.customer_name ?? row.orders?.customer_email ?? "Onbekende klant",
    provider: String(row.provider ?? "mollie"),
    providerPaymentId: row.provider_payment_id ?? null,
    status: String(row.status ?? "draft"),
    amountCents: Number(row.amount_cents ?? 0),
    checkoutUrl: row.checkout_url ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  }));
}
