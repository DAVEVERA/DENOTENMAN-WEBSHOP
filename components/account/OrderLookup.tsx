"use client";

import { useState } from "react";
import type nl from "@/dictionaries/nl.json";
import type { Locale } from "@/lib/i18n";
import { formatPrice, formatDate } from "@/lib/format";
import { postnlTrackingUrl } from "@/lib/shipping";
import { getPickupLocation } from "@/lib/pickup-locations";

type AccountOrdersDictionary = (typeof nl)["accountOrders"];
type CheckoutDictionary = (typeof nl)["checkout"];
type OrderDictionary = (typeof nl)["order"];

type OrderLookupResponse = {
  id: string;
  status: "PENDING" | "PAID" | "FULFILLED" | "CANCELLED" | "REFUNDED";
  createdAt: string;
  subtotalCents: number;
  discountCode: string | null;
  discountCents: number;
  shippingCents: number;
  totalCents: number;
  deliveryMethod: "SHIPPING" | "PICKUP";
  pickupLocationId: string | null;
  shippingStreet: string | null;
  shippingHouseNumber: string | null;
  shippingPostalCode: string | null;
  shippingCity: string | null;
  shippingCountry: string;
  postnlTrackingCode: string | null;
  items: {
    id: string;
    productName: string;
    variantLabel: string;
    quantity: number;
    unitPriceCents: number;
  }[];
};

export function OrderLookup({
  locale,
  dictionary,
  checkoutDictionary,
  orderDictionary,
}: {
  locale: Locale;
  dictionary: AccountOrdersDictionary;
  checkoutDictionary: CheckoutDictionary;
  orderDictionary: OrderDictionary;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderLookupResponse | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/account/order-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: form.get("orderId"),
          email: form.get("email"),
        }),
      });

      if (!response.ok) {
        setError(dictionary.notFound);
        setSubmitting(false);
        return;
      }

      const data: OrderLookupResponse = await response.json();
      setOrder(data);
      setSubmitting(false);
    } catch {
      setError(checkoutDictionary.genericError);
      setSubmitting(false);
    }
  }

  if (order) {
    const view: "PAID" | "PENDING" | "CANCELLED" =
      order.status === "PAID" || order.status === "FULFILLED"
        ? "PAID"
        : order.status === "CANCELLED" || order.status === "REFUNDED"
          ? "CANCELLED"
          : "PENDING";

    const statusTitle = {
      PAID: orderDictionary.paidTitle,
      PENDING: orderDictionary.pendingTitle,
      CANCELLED: orderDictionary.cancelledTitle,
    }[view];

    return (
      <div className="rounded-panel border border-border bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-heading text-heading-sm text-text">{statusTitle}</h3>
            <p className="mt-1 text-body-sm text-muted">
              {orderDictionary.orderNumber}: <span className="font-mono">{order.id}</span>
            </p>
            <p className="text-body-sm text-muted">{formatDate(new Date(order.createdAt), locale)}</p>
          </div>
          <button
            type="button"
            onClick={() => setOrder(null)}
            className="font-heading text-body-sm font-semibold text-muted underline decoration-border-hover underline-offset-4 hover:text-text"
          >
            {dictionary.newLookup}
          </button>
        </div>

        <div className="mt-5">
          <p className="font-heading text-body-sm font-bold text-text">{dictionary.itemsTitle}</p>
          <ul className="mt-2 divide-y divide-border">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-2 text-body-sm">
                <span className="min-w-0 text-text">
                  {item.quantity}× {item.productName}
                  {item.variantLabel ? (
                    <span className="text-muted"> ({item.variantLabel})</span>
                  ) : null}
                </span>
                <span className="shrink-0 text-text">
                  {formatPrice(item.unitPriceCents * item.quantity, locale)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4 space-y-1 border-t border-border pt-4 text-body-sm">
          <div className="flex justify-between text-muted">
            <span>{checkoutDictionary.subtotal}</span>
            <span>{formatPrice(order.subtotalCents, locale)}</span>
          </div>
          {order.discountCents > 0 ? (
            <div className="flex justify-between font-semibold text-green-700">
              <span>
                {checkoutDictionary.discount}
                {order.discountCode ? ` (${order.discountCode})` : ""}
              </span>
              <span>-{formatPrice(order.discountCents, locale)}</span>
            </div>
          ) : null}
          <div className="flex justify-between text-muted">
            <span>{checkoutDictionary.shipping}</span>
            <span>
              {order.shippingCents === 0
                ? checkoutDictionary.shippingFree
                : formatPrice(order.shippingCents, locale)}
            </span>
          </div>
          <div className="flex justify-between font-heading font-semibold text-text">
            <span>{checkoutDictionary.total}</span>
            <span>{formatPrice(order.totalCents, locale)}</span>
          </div>
        </div>

        <div className="mt-4 border-t border-border pt-4 text-body-sm">
          {order.deliveryMethod === "PICKUP" ? (
            <>
              <p className="font-heading font-bold text-text">
                {checkoutDictionary.deliveryMethodPickup}
              </p>
              <p className="mt-1 text-muted">
                {order.pickupLocationId
                  ? getPickupLocation(order.pickupLocationId)?.name ?? order.pickupLocationId
                  : "—"}
              </p>
            </>
          ) : (
            <>
              <p className="font-heading font-bold text-text">
                {checkoutDictionary.shippingHeading}
              </p>
              <p className="mt-1 text-muted">
                {order.shippingStreet} {order.shippingHouseNumber}
                <br />
                {order.shippingPostalCode} {order.shippingCity}
              </p>
            </>
          )}
        </div>

        {order.deliveryMethod === "SHIPPING" && order.postnlTrackingCode ? (
          <div className="mt-4 border-t border-border pt-4 text-body-sm">
            <p className="font-heading font-bold text-text">{dictionary.trackingLabel}</p>
            <a
              href={postnlTrackingUrl(
                order.postnlTrackingCode,
                order.shippingPostalCode ?? "",
                order.shippingCountry
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block font-heading font-semibold text-accent-hover underline underline-offset-4"
            >
              {dictionary.trackingCta}
            </a>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-panel border border-border bg-surface p-5"
      noValidate
    >
      <p className="text-body-sm text-muted">{dictionary.intro}</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="lookup-email" className="block text-body-sm font-semibold text-text">
            {checkoutDictionary.email}
          </label>
          <input
            id="lookup-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="mt-1 w-full rounded-button border border-border px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="lookup-order-id" className="block text-body-sm font-semibold text-text">
            {dictionary.orderIdLabel}
          </label>
          <input
            id="lookup-order-id"
            name="orderId"
            type="text"
            required
            className="mt-1 w-full rounded-button border border-border px-3 py-2 font-mono"
          />
          <p className="mt-1 text-body-sm text-muted">{dictionary.orderIdHint}</p>
        </div>
      </div>

      {error ? <p className="mt-3 text-body-sm text-red-600">{error}</p> : null}

      <button
        type="submit"
        disabled={submitting}
        className="mt-4 inline-flex items-center justify-center rounded-button border border-accent bg-accent px-5 py-2.5 font-heading text-body-md font-semibold text-contrast shadow-button transition-colors duration-hover-fast hover:border-accent-hover hover:bg-accent-hover disabled:opacity-60"
      >
        {submitting ? dictionary.submitting : dictionary.submit}
      </button>
    </form>
  );
}
