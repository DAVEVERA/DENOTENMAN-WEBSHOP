"use client";

import Link from "next/link";
import { Minus, Plus, Trash2 } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { formatPrice } from "@/lib/format";
import { product as productPath, checkout as checkoutPath } from "@/lib/routes";
import {
  removeCartItem,
  updateCartQuantity,
  useStorefrontState,
} from "@/lib/storefront-state";

export function CartPanel({
  locale,
  labels,
  freeShippingThresholdCents,
}: {
  locale: Locale;
  labels: {
    empty: string;
    total: string;
    checkout: string;
    remove: string;
    decrease: string;
    increase: string;
    freeShippingProgress: string;
    freeShippingReached: string;
  };
  freeShippingThresholdCents: number;
}) {
  const { cart } = useStorefrontState();
  const total = cart.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
  const remainingCents = Math.max(0, freeShippingThresholdCents - total);
  const progressPercent = Math.min(
    100,
    Math.round((total / freeShippingThresholdCents) * 100)
  );

  if (cart.length === 0) {
    return (
      <div className="rounded-panel border border-dashed border-border bg-surface p-8 text-center text-muted">
        {labels.empty}
      </div>
    );
  }

  return (
    <div>
      <ul className="space-y-3">
        {cart.map((item) => (
          <li
            key={item.variantId}
            className="flex gap-3 rounded-card border border-border bg-surface p-3 shadow-card sm:gap-5 sm:p-5"
          >
            <Link
              href={productPath(item.locale, item.slug)}
              className="h-20 w-20 shrink-0 overflow-hidden rounded-full border border-border bg-background sm:h-24 sm:w-24"
            >
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="h-full w-full rounded-full object-cover"
                />
              ) : null}
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    href={productPath(item.locale, item.slug)}
                    className="font-heading font-semibold leading-tight text-text hover:text-accent-hover"
                  >
                    {item.name}
                  </Link>
                  <p className="mt-1 text-xs text-muted sm:text-body-sm">{item.variantLabel}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeCartItem(item.variantId)}
                  aria-label={`${labels.remove}: ${item.name}`}
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-background hover:text-red-600"
                >
                  <Trash2 className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex h-11 items-center rounded-button border border-border">
                  <button
                    type="button"
                    aria-label={labels.decrease}
                    onClick={() => updateCartQuantity(item.variantId, item.quantity - 1)}
                    className="inline-flex h-11 w-11 items-center justify-center"
                  >
                    <Minus className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <span className="min-w-8 text-center font-semibold">{item.quantity}</span>
                  <button
                    type="button"
                    aria-label={labels.increase}
                    onClick={() => updateCartQuantity(item.variantId, item.quantity + 1)}
                    className="inline-flex h-11 w-11 items-center justify-center"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
                <p className="font-heading text-lg font-semibold text-text">
                  {formatPrice(item.priceCents * item.quantity, locale)}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-6 rounded-card border border-border bg-surface p-4 shadow-card" aria-live="polite">
        <p className="text-sm font-semibold text-text">
          {remainingCents > 0
            ? labels.freeShippingProgress.replace("{amount}", formatPrice(remainingCents, locale))
            : labels.freeShippingReached}
        </p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-accent transition-all duration-hover-fast"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between rounded-card bg-contrast px-5 py-4 text-surface">
        <span className="font-heading text-lg font-semibold">{labels.total}</span>
        <span className="font-heading text-xl font-semibold">{formatPrice(total, locale)}</span>
      </div>
      <Link
        href={checkoutPath(locale)}
        className="mt-4 flex min-h-11 items-center justify-center rounded-button border border-accent bg-accent px-6 py-3 font-heading tracking-heading text-contrast shadow-button transition-colors duration-hover-fast hover:border-accent-hover hover:bg-accent-hover"
      >
        {labels.checkout}
      </Link>
    </div>
  );
}
