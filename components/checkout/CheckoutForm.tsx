"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type nl from "@/dictionaries/nl.json";
import type { Locale } from "@/lib/i18n";
import { formatPrice } from "@/lib/format";
import { cart as cartPath } from "@/lib/routes";
import { useStorefrontState, type CartItem } from "@/lib/storefront-state";
import { calculateShippingCents, type ShippingCountryCode } from "@/lib/shipping";
import { getPickupLocationsForCountry, closestPickupLocationId } from "@/lib/pickup-locations";
import { pagePath } from "@/lib/pages";
import {
  GOOGLE_ANALYTICS_READY_EVENT,
  cartToGoogleAnalyticsItems,
  sendGoogleAnalyticsEvent,
  sendGoogleAnalyticsEventBeforeNavigation,
} from "@/lib/analytics";
import { Button } from "@/components/ui/Button";

type DeliveryMethod = "SHIPPING" | "PICKUP";
type CountryCode = ShippingCountryCode;

type CheckoutDictionary = (typeof nl)["checkout"];
type AppliedDiscountPreview = {
  code: string;
  discountCents: number;
  isTest: boolean;
};

function legacyCartWeightGrams(item: CartItem): number | null {
  if (
    typeof item.weightGrams === "number" &&
    Number.isSafeInteger(item.weightGrams) &&
    item.weightGrams > 0
  ) {
    return item.weightGrams;
  }

  const normalized = item.variantLabel.toLocaleLowerCase("nl-NL").replace(",", ".");
  const match = /(\d+(?:\.\d+)?)\s*(kg|kilogram|g|gram|ml)\b/u.exec(normalized);
  if (!match) return null;

  const amount = Number(match[1]);
  const weightGrams = match[2] === "kg" || match[2] === "kilogram" ? amount * 1_000 : amount;
  return Number.isSafeInteger(weightGrams) && weightGrams > 0 ? weightGrams : null;
}

function checkoutCartWeightGrams(cart: CartItem[]): number | null {
  let totalWeightGrams = 0;

  for (const item of cart) {
    const itemWeightGrams = legacyCartWeightGrams(item);
    if (itemWeightGrams === null) return null;
    totalWeightGrams += itemWeightGrams * item.quantity;
  }

  return Number.isSafeInteger(totalWeightGrams) && totalWeightGrams > 0
    ? totalWeightGrams
    : null;
}

export function CheckoutForm({
  locale,
  dictionary,
  initialCountry = "NL",
}: {
  locale: Locale;
  dictionary: CheckoutDictionary;
  initialCountry?: CountryCode;
}) {
  const { cart } = useStorefrontState();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discountInput, setDiscountInput] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState<AppliedDiscountPreview | null>(null);
  const [checkingDiscount, setCheckingDiscount] = useState(false);
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [contactEmail, setContactEmail] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("SHIPPING");
  const [country, setCountry] = useState<CountryCode>(initialCountry);
  const [pickupLocationId, setPickupLocationId] = useState<string>("");
  const [pickupPostalCode, setPickupPostalCode] = useState("");
  const trackedCheckoutKey = useRef<string | null>(null);

  const pickupLocations = getPickupLocationsForCountry(country);
  const isPickup = deliveryMethod === "PICKUP";

  const subtotalCents = cart.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
  const totalWeightGrams = checkoutCartWeightGrams(cart);
  const regularShippingCents = calculateShippingCents({
    country,
    subtotalCents,
    totalWeightGrams,
    deliveryMethod,
  });
  const discountCents = appliedDiscount?.discountCents ?? 0;
  const shippingCents = appliedDiscount?.isTest ? 0 : regularShippingCents;
  const totalCents = subtotalCents - discountCents + shippingCents;
  const merchandiseValue = Math.max(0, subtotalCents - discountCents) / 100;

  useEffect(() => {
    if (cart.length === 0) return;

    const checkoutKey = cart
      .map((item) => `${item.variantId}:${item.quantity}`)
      .sort()
      .join("|");

    function trackCheckoutStart() {
      if (trackedCheckoutKey.current === checkoutKey) return;

      const sent = sendGoogleAnalyticsEvent("begin_checkout", {
        currency: "EUR",
        value: merchandiseValue,
        ...(appliedDiscount?.code ? { coupon: appliedDiscount.code } : {}),
        items: cartToGoogleAnalyticsItems(cart),
      });
      if (sent) trackedCheckoutKey.current = checkoutKey;
    }

    trackCheckoutStart();
    window.addEventListener(GOOGLE_ANALYTICS_READY_EVENT, trackCheckoutStart);
    return () => window.removeEventListener(GOOGLE_ANALYTICS_READY_EVENT, trackCheckoutStart);
  }, [appliedDiscount?.code, cart, merchandiseValue]);

  function handleDeliveryMethodChange(method: DeliveryMethod) {
    setDeliveryMethod(method);
    if (method === "SHIPPING") {
      setPickupLocationId("");
    } else {
      setPickupLocationId(
        closestPickupLocationId(country, pickupPostalCode) ??
          getPickupLocationsForCountry(country)[0]?.id ??
          ""
      );
    }
  }

  function handleCountryChange(nextCountry: CountryCode) {
    setCountry(nextCountry);
    if (isPickup) {
      const locations = getPickupLocationsForCountry(nextCountry);
      setPickupLocationId(
        closestPickupLocationId(nextCountry, pickupPostalCode) ?? locations[0]?.id ?? ""
      );
    }
  }

  async function applyDiscountCode() {
    setCheckingDiscount(true);
    setDiscountError(null);
    try {
      const response = await fetch("/api/discounts/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: discountInput,
          subtotalCents,
          country,
          totalWeightGrams,
          deliveryMethod,
          email: contactEmail,
        }),
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
            deliveryMethod,
            country,
            ...(isPickup
              ? { pickupLocationId }
              : {
                  street: form.get("street"),
                  houseNumber: form.get("houseNumber"),
                  postalCode: form.get("postalCode"),
                  city: form.get("city"),
                }),
          },
          lines: cart.map((item) => ({
            variantId: item.variantId,
            quantity: item.quantity,
            productSlug: item.slug,
            variantLabel: item.variantLabel,
          })),
          discountCode: appliedDiscount?.code ?? undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        sendGoogleAnalyticsEvent("checkout_error", {
          checkout_stage: "create_payment",
          error_code:
            typeof data?.error === "string" ? data.error : `HTTP_${response.status}`,
          delivery_method: deliveryMethod.toLowerCase(),
          payment_provider: "mollie",
          currency: "EUR",
          value: merchandiseValue,
          items: cartToGoogleAnalyticsItems(cart),
        });
        if (data.error === "OUT_OF_STOCK") {
          setError(dictionary.errorOutOfStock);
        } else if (data.error === "INVALID_CONTACT") {
          setError(dictionary.errorInvalidContact);
        } else if (data.error === "INVALID_PICKUP_LOCATION") {
          setError(dictionary.errorInvalidPickupLocation);
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

      sendGoogleAnalyticsEventBeforeNavigation(
        "add_payment_info",
        {
          currency: "EUR",
          value: merchandiseValue,
          payment_type: "Mollie",
          ...(appliedDiscount?.code ? { coupon: appliedDiscount.code } : {}),
          items: cartToGoogleAnalyticsItems(cart),
        },
        () => {
          window.location.href = data.checkoutUrl;
        }
      );
    } catch {
      sendGoogleAnalyticsEvent("checkout_error", {
        checkout_stage: "create_payment",
        error_code: "NETWORK_OR_CLIENT_ERROR",
        delivery_method: deliveryMethod.toLowerCase(),
        payment_provider: "mollie",
        currency: "EUR",
        value: merchandiseValue,
        items: cartToGoogleAnalyticsItems(cart),
      });
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
              className="mt-1 min-h-11 w-full rounded-button border border-border px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-contrast"
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
              value={contactEmail}
              onChange={(event) => {
                setContactEmail(event.target.value);
                if (appliedDiscount) {
                  setAppliedDiscount(null);
                  setDiscountError(null);
                }
              }}
              required
              autoComplete="email"
              className="mt-1 min-h-11 w-full rounded-button border border-border px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-contrast"
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
              className="mt-1 min-h-11 w-full rounded-button border border-border px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-contrast"
            />
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="font-heading text-heading-sm text-text">
            {dictionary.deliveryMethodHeading}
          </legend>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => handleDeliveryMethodChange("SHIPPING")}
              aria-pressed={!isPickup}
              className={`flex-1 rounded-button border px-4 py-2 text-body-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-contrast ${
                !isPickup
                  ? "border-text bg-text text-surface"
                  : "border-border bg-surface text-text hover:border-text"
              }`}
            >
              {dictionary.deliveryMethodShipping}
            </button>
            <button
              type="button"
              onClick={() => handleDeliveryMethodChange("PICKUP")}
              aria-pressed={isPickup}
              className={`flex-1 rounded-button border px-4 py-2 text-body-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-contrast ${
                isPickup
                  ? "border-text bg-text text-surface"
                  : "border-border bg-surface text-text hover:border-text"
              }`}
            >
              {dictionary.deliveryMethodPickup}
            </button>
          </div>

          <div>
            <label htmlFor="country" className="block text-body-sm font-semibold text-text">
              {dictionary.countryLabel}
            </label>
            <select
              id="country"
              value={country}
              onChange={(event) => handleCountryChange(event.target.value as CountryCode)}
              className="mt-1 min-h-11 w-full rounded-button border border-border px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-contrast"
            >
              <option value="NL">{dictionary.countryNL}</option>
              <option value="BE">{dictionary.countryBE}</option>
            </select>
          </div>
        </fieldset>

        {isPickup ? (
          <fieldset className="space-y-3">
            <legend className="font-heading text-heading-sm text-text">
              {dictionary.pickupLocationHeading}
            </legend>
            {country === "NL" ? (
              <input
                type="text"
                value={pickupPostalCode}
                onChange={(event) => {
                  setPickupPostalCode(event.target.value);
                  setPickupLocationId(
                    closestPickupLocationId("NL", event.target.value) ?? pickupLocationId
                  );
                }}
                placeholder={dictionary.postalCode}
                autoComplete="postal-code"
                className="min-h-11 w-full rounded-button border border-border px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-contrast"
              />
            ) : null}
            <div className="space-y-2">
              {pickupLocations.map((location) => (
                <label
                  key={location.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-button border px-3 py-2 text-body-sm ${
                    pickupLocationId === location.id ? "border-text" : "border-border"
                  }`}
                >
                  <input
                    type="radio"
                    name="pickupLocation"
                    value={location.id}
                    checked={pickupLocationId === location.id}
                    onChange={() => setPickupLocationId(location.id)}
                  />
                  <span className="text-text">{location.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : (
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
                  className="mt-1 min-h-11 w-full rounded-button border border-border px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-contrast"
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
                  className="mt-1 min-h-11 w-full rounded-button border border-border px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-contrast"
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
                  className="mt-1 min-h-11 w-full rounded-button border border-border px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-contrast"
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
                  className="mt-1 min-h-11 w-full rounded-button border border-border px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-contrast"
                />
              </div>
            </div>
          </fieldset>
        )}
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
                className="min-h-11 min-w-0 flex-1 rounded-button border border-border px-3 py-2 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-contrast sm:text-body-sm"
              />
              <button
                type="button"
                onClick={applyDiscountCode}
                disabled={checkingDiscount}
                className="min-h-11 shrink-0 rounded-button border border-text bg-text px-4 py-2 font-heading text-body-sm font-semibold text-surface transition-colors hover:bg-accent-hover hover:text-contrast focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-contrast"
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

        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-card border border-border bg-surface p-4 text-body-sm text-text">
          <input
            type="checkbox"
            name="legalAgreement"
            required
            className="mt-1 h-5 w-5 shrink-0 accent-[#333333] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-contrast"
          />
          <span className="leading-relaxed">
            {dictionary.legalAgreement}{" "}
            <Link className="font-semibold underline underline-offset-4" href={pagePath("terms", locale)}>
              {dictionary.termsLabel}
            </Link>
            ,{" "}
            <Link className="font-semibold underline underline-offset-4" href={pagePath("additionalTerms", locale)}>
              {dictionary.additionalTermsLabel}
            </Link>
            ,{" "}
            <Link className="font-semibold underline underline-offset-4" href={pagePath("privacy", locale)}>
              {dictionary.privacyLabel}
            </Link>{" "}
            {dictionary.and}{" "}
            <Link className="font-semibold underline underline-offset-4" href={pagePath("shippingReturns", locale)}>
              {dictionary.returnsLabel}
            </Link>
            .
          </span>
        </label>

        <Button type="submit" busy={submitting} className="mt-4 w-full" size="lg">
          {submitting ? dictionary.submitting : dictionary.submit}
        </Button>
      </div>
    </form>
  );
}
