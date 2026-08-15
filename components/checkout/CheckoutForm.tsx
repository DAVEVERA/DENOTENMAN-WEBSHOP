"use client";

import { useState } from "react";
import Link from "next/link";
import type nl from "@/dictionaries/nl.json";
import type { Locale } from "@/lib/i18n";
import { formatPrice } from "@/lib/format";
import { cart as cartPath } from "@/lib/routes";
import { useStorefrontState } from "@/lib/storefront-state";
import { FREE_SHIPPING_THRESHOLD_CENTS, FLAT_SHIPPING_CENTS } from "@/lib/shipping";
import { Button } from "@/components/ui/Button";

type CheckoutDictionary = (typeof nl)["checkout"];
type AppliedDiscountPreview = {
  code: string;
  discountCents: number;
  shippingCents: number;
  totalCents: number;
  isTest: boolean;
};

export function CheckoutForm({
  locale,
  dictionary,
}: {
  locale: Locale;
  dictionary: CheckoutDictionary;
}) {
  const { cart } = useStorefrontState();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discountInput, setDiscountInput] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState<AppliedDiscountPreview | null>(null);
  const [checkingDiscount, setCheckingDiscount] = useState(false);
  const [discountError, setDiscountError] = useState<string | null>(null);

  const subtotalCents = cart.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
  const regularShippingCents =
    subtotalCents === 0 || subtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS
      ? 0
      : FLAT_SHIPPING_CENTS;
  const discountCents = appliedDiscount?.discountCents ?? 0;
  const shippingCents = appliedDiscount?.shippingCents ?? regularShippingCents;
  const totalCents = appliedDiscount?.totalCents ?? subtotalCents + regularShippingCents;

  async function applyDiscountCode() {
    setCheckingDiscount(true);
    setDiscountError(null);
    try {
      const response = await fetch("/api/discounts/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: discountInput, subtotalCents }),
      });
      const result = (await response.json().catch(() => null)) as AppliedDiscountPreview | null;

      if (!response.ok || !result) {
        setAppliedDiscount(null);
        setDiscountError(dictionary.discountInvalid);
        return;
      }

      setDiscountInput(result.code);
      setAppliedDiscount(result);
    } catch {
      setAppliedDiscount(null);
      setDiscountError(dictionary.discountInvalid);
    } finally {
      setCheckingDiscount(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (cart.length === 0) return;

    const form = new FormData(event.currentTarget);
    setSubmitting(true);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale,
          contact: {
            name: form.get("name"),
            email: form.get("email"),
            phone: form.get("phone") || undefined,
            street: form.get("street"),
            houseNumber: form.get("houseNumber"),
            postalCode: form.get("postalCode"),
            city: form.get("city"),
            country: "NL",
          },
          lines: cart.map((item) => ({ variantId: item.variantId, quantity: item.quantity })),
          discountCode: appliedDiscount?.code ?? undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error === "OUT_OF_STOCK") {
          setError(dictionary.errorOutOfStock);
        } else if (data.error === "INVALID_CONTACT") {
          setError(dictionary.errorInvalidContact);
        } else if (data.error === "INVALID_DISCOUNT_CODE") {
          setError(dictionary.discountInvalid);
        } else if (data.error === "DISCOUNT_NOT_ELIGIBLE") {
          setAppliedDiscount(null);
          setDiscountError(dictionary.discountNotEligible);
          setError(dictionary.discountNotEligible);
        } else {
          setError(dictionary.genericError);
        }
        setSubmitting(false);
        return;
      }

      window.location.href = data.checkoutUrl;
    } catch {
      setError(dictionary.genericError);
      setSubmitting(false);
    }
  }

  if (cart.length === 0) {
    return (
      <div className="rounded-panel border border-dashed border-border bg-surface p-8 text-center text-muted">
        <p>{dictionary.emptyCart}</p>
        <Link
          href={cartPath(locale)}
          className="mt-4 inline-block font-heading font-semibold text-accent-hover underline underline-offset-4"
        >
          {dictionary.backToCart}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      <div className="space-y-6">
        <fieldset className="space-y-4">
          <legend className="font-heading text-heading-sm text-text">
            {dictionary.contactHeading}
          </legend>
          <div>
            <label htmlFor="name" className="block text-body-sm font-semibold text-text">
              {dictionary.name}
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              autoComplete="name"
              className="mt-1 w-full rounded-button border border-border px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-body-sm font-semibold text-text">
              {dictionary.email}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="mt-1 w-full rounded-button border border-border px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="phone" className="block text-body-sm font-semibold text-text">
              {dictionary.phone}
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              className="mt-1 w-full rounded-button border border-border px-3 py-2"
            />
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="font-heading text-heading-sm text-text">
            {dictionary.shippingHeading}
          </legend>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label htmlFor="street" className="block text-body-sm font-semibold text-text">
                {dictionary.street}
              </label>
              <input
                id="street"
                name="street"
                type="text"
                required
                autoComplete="address-line1"
                className="mt-1 w-full rounded-button border border-border px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="houseNumber" className="block text-body-sm font-semibold text-text">
                {dictionary.houseNumber}
              </label>
              <input
                id="houseNumber"
                name="houseNumber"
                type="text"
                required
                className="mt-1 w-full rounded-button border border-border px-3 py-2"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="postalCode" className="block text-body-sm font-semibold text-text">
                {dictionary.postalCode}
              </label>
              <input
                id="postalCode"
                name="postalCode"
                type="text"
                required
                autoComplete="postal-code"
                className="mt-1 w-full rounded-button border border-border px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="city" className="block text-body-sm font-semibold text-text">
                {dictionary.city}
              </label>
              <input
                id="city"
                name="city"
                type="text"
                required
                autoComplete="address-level2"
                className="mt-1 w-full rounded-button border border-border px-3 py-2"
              />
            </div>
          </div>
        </fieldset>
      </div>

      <div>
        <div className="rounded-panel border border-border bg-surface p-5">
          <h2 className="font-heading text-heading-sm text-text">{dictionary.summaryHeading}</h2>
          <ul className="mt-4 space-y-2">
            {cart.map((item) => (
              <li key={item.variantId} className="flex justify-between gap-3 text-body-sm">
                <span className="text-muted">
                  {item.quantity}x {item.name}
                </span>
                <span className="shrink-0 text-text">
                  {formatPrice(item.priceCents * item.quantity, locale)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 border-t border-border pt-4">
            <label htmlFor="discountCode" className="block text-body-sm font-semibold text-text">
              {dictionary.discountCode}
            </label>
            <div className="mt-1 flex gap-2">
              <input
                id="discountCode"
                name="discountCode"
                type="text"
                value={discountInput}
                onChange={(event) => {
                  setDiscountInput(event.target.value);
                  setAppliedDiscount(null);
                  setDiscountError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    applyDiscountCode();
                  }
                }}
                placeholder={dictionary.discountPlaceholder}
                autoComplete="off"
                className="min-w-0 flex-1 rounded-button border border-border px-3 py-2 text-body-sm"
              />
              <button
                type="button"
                onClick={applyDiscountCode}
                disabled={checkingDiscount}
                className="shrink-0 rounded-button border border-text bg-text px-4 py-2 font-heading text-body-sm font-semibold text-surface transition-colors hover:bg-accent-hover hover:text-contrast"
              >
                {checkingDiscount ? "Controleren…" : dictionary.applyDiscount}
              </button>
            </div>
            <p
              aria-live="polite"
              className={`mt-2 text-body-sm ${discountError ? "text-red-600" : "text-green-700"}`}
            >
              {discountError ?? (appliedDiscount ? dictionary.discountApplied : "")}
            </p>
          </div>
          <div className="mt-4 space-y-1 border-t border-border pt-4 text-body-sm">
            <div className="flex justify-between">
              <span className="text-muted">{dictionary.subtotal}</span>
              <span>{formatPrice(subtotalCents, locale)}</span>
            </div>
            {appliedDiscount ? (
              <div className="flex justify-between font-semibold text-green-700">
                <span>{dictionary.discount} ({appliedDiscount.code})</span>
                <span>-{formatPrice(discountCents, locale)}</span>
              </div>
            ) : null}
            <div className="flex justify-between">
              <span className="text-muted">{dictionary.shipping}</span>
              <span>{shippingCents === 0 ? dictionary.shippingFree : formatPrice(shippingCents, locale)}</span>
            </div>
          </div>
          <div className="mt-3 flex justify-between border-t border-border pt-3 font-heading text-heading-sm font-semibold text-text">
            <span>{dictionary.total}</span>
            <span>{formatPrice(totalCents, locale)}</span>
          </div>
        </div>

        {error ? (
          <p role="alert" className="mt-4 text-body-sm font-semibold text-red-600">
            {error}
          </p>
        ) : null}

        <Button type="submit" busy={submitting} className="mt-4 w-full" size="lg">
          {submitting ? dictionary.submitting : dictionary.submit}
        </Button>
      </div>
    </form>
  );
}
