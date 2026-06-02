import "server-only";
import { createOrderNumber } from "@denotenman/commerce";
import { createMolliePayment } from "@denotenman/mollie";
import type { CheckoutState } from "./checkout";
import type { StorefrontCart } from "./cart";
import { createStorefrontServiceClient } from "./supabase/server";

export type PendingOrderDraft = {
  orderId: string;
  orderNumber: string;
  paymentId: string;
  checkoutUrl: string | null;
  providerPaymentId: string | null;
};

export type OrderCheckoutStatus = {
  orderNumber: string;
  orderStatus: string;
  paymentStatus: string;
  totalCents: number | null;
  paymentProvider: string | null;
  providerPaymentId: string | null;
};

function createOrderSequence(date = new Date()) {
  const seconds = date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
  return seconds;
}

function getCustomerName(checkout: CheckoutState) {
  return [checkout.firstName, checkout.lastName]
    .filter((part) => part && part !== "-")
    .join(" ")
    .trim();
}

export async function createPendingOrderDraft(
  cart: StorefrontCart,
  checkout: CheckoutState,
): Promise<PendingOrderDraft> {
  if (cart.items.length === 0) {
    throw new Error("Winkelwagen is leeg.");
  }

  const supabase = createStorefrontServiceClient();
  const now = new Date();
  const orderNumber = createOrderNumber(now, createOrderSequence(now));
  const checkoutState = {
    email: checkout.email,
    firstName: checkout.firstName,
    lastName: checkout.lastName,
    phone: checkout.phone,
    street: checkout.street,
    houseNumber: checkout.houseNumber,
    postalCode: checkout.postalCode,
    city: checkout.city,
    country: checkout.country,
    shippingMethodId: checkout.shippingMethodId,
    shippingNote: checkout.shippingNote,
    paymentMethod: checkout.paymentMethod,
  };

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      order_number: orderNumber,
      amount_total: cart.totalCents,
      total_cents: cart.totalCents,
      subtotal_cents: cart.subtotalCents,
      shipping_cents: cart.shippingCents,
      tax_cents: cart.taxCents,
      currency: "EUR",
      customer_email: checkout.email,
      customer_name: getCustomerName(checkout),
      status: "pending",
      payment_status: "draft",
      checkout_state: checkoutState,
      items: cart.items,
    })
    .select("id,order_number")
    .single();

  if (orderError) {
    throw new Error(orderError.message);
  }

  const orderId = String(order.id);
  const { error: itemsError } = await supabase.from("order_items").insert(
    cart.items.map((item) => ({
      order_id: orderId,
      product_id: item.productId,
      variant_id: item.variantId,
      weight_id: item.weightId,
      name: item.name,
      quantity: item.quantity,
      unit_price_cents: item.unitPriceCents,
      line_total_cents: item.unitPriceCents * item.quantity,
      image: item.image,
      metadata: {
        slug: item.slug,
        weightLabel: item.weightLabel,
      },
    })),
  );

  if (itemsError) {
    throw new Error(itemsError.message);
  }

  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .insert({
      order_id: orderId,
      provider: "mollie",
      status: "draft",
      amount_cents: cart.totalCents,
      currency: "EUR",
    })
    .select("id")
    .single();

  if (paymentError) {
    throw new Error(paymentError.message);
  }

  return {
    orderId,
    orderNumber: String(order.order_number ?? orderNumber),
    paymentId: String(payment.id),
    checkoutUrl: null,
    providerPaymentId: null,
  };
}

function getSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
}

function canCreateMolliePayment() {
  return (
    process.env.MOLLIE_ENABLE_PAYMENTS === "true" &&
    typeof process.env.MOLLIE_API_KEY === "string" &&
    process.env.MOLLIE_API_KEY.startsWith("test_")
  );
}

export async function createPendingOrderWithOptionalMolliePayment(
  cart: StorefrontCart,
  checkout: CheckoutState,
) {
  const draft = await createPendingOrderDraft(cart, checkout);

  if (!canCreateMolliePayment()) {
    return draft;
  }

  const siteUrl = getSiteUrl();
  const molliePayment = await createMolliePayment(
    { apiKey: process.env.MOLLIE_API_KEY ?? "" },
    {
      amountCents: cart.totalCents,
      description: `De Notenman ${draft.orderNumber}`,
      redirectUrl: `${siteUrl}/checkout/succes?order=${encodeURIComponent(draft.orderNumber)}`,
      webhookUrl: `${siteUrl}/api/mollie/webhook`,
      metadata: {
        orderId: draft.orderId,
        orderNumber: draft.orderNumber,
      },
    },
  );

  const checkoutUrl = molliePayment._links?.checkout?.href ?? null;
  const supabase = createStorefrontServiceClient();
  const { error: paymentError } = await supabase
    .from("payments")
    .update({
      provider_payment_id: molliePayment.id,
      status: molliePayment.status,
      checkout_url: checkoutUrl,
      raw_payload: molliePayment,
      updated_at: new Date().toISOString(),
    })
    .eq("id", draft.paymentId);

  if (paymentError) {
    throw new Error(paymentError.message);
  }

  const { error: orderError } = await supabase
    .from("orders")
    .update({
      payment_status: molliePayment.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", draft.orderId);

  if (orderError) {
    throw new Error(orderError.message);
  }

  return {
    ...draft,
    checkoutUrl,
    providerPaymentId: molliePayment.id,
  };
}

export async function getOrderCheckoutStatus(
  orderNumber: string | null | undefined,
): Promise<OrderCheckoutStatus | null> {
  if (!orderNumber) return null;

  const supabase = createStorefrontServiceClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select("id,order_number,status,payment_status,total_cents")
    .eq("order_number", orderNumber)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!order) return null;

  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .select("provider,provider_payment_id")
    .eq("order_id", order.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (paymentError) {
    throw new Error(paymentError.message);
  }

  return {
    orderNumber: String(order.order_number ?? orderNumber),
    orderStatus: String(order.status ?? "pending"),
    paymentStatus: String(order.payment_status ?? "draft"),
    totalCents: typeof order.total_cents === "number" ? order.total_cents : null,
    paymentProvider: payment?.provider ? String(payment.provider) : null,
    providerPaymentId: payment?.provider_payment_id ? String(payment.provider_payment_id) : null,
  };
}
