"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n";
import { addCartItem, useStorefrontState } from "@/lib/storefront-state";
import { formatPrice } from "@/lib/format";
import { getShippingPolicy, type ShippingCountryCode } from "@/lib/shipping";

type Suggestion = {
  variantId: string; productId: string; slug: string; name: string; variantLabel: string;
  weightGrams: number; priceCents: number; quantity: number; overageCents: number; imageUrl: string | null;
};

export function ShippingAddons({ locale, country, subtotalCents }: { locale: Locale; country: ShippingCountryCode; subtotalCents: number }) {
  const { cart } = useStorefrontState();
  const threshold = getShippingPolicy(country).freeShippingThresholdCents;
  if (cart.length === 0 || subtotalCents >= threshold) return null;
  const cartKey = JSON.stringify(cart.map((item) => [item.variantId, item.quantity]));
  return <ShippingAddonsSuggestions key={`${country}:${locale}:${cartKey}`} locale={locale} country={country} subtotalCents={subtotalCents} cartKey={cartKey} threshold={threshold} />;
}

function ShippingAddonsSuggestions({ locale, country, subtotalCents, cartKey, threshold }: { locale: Locale; country: ShippingCountryCode; subtotalCents: number; cartKey: string; threshold: number }) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [addedId, setAddedId] = useState<string | null>(null);

  useEffect(() => {
    const lines = JSON.parse(cartKey) as Array<[string, number]>;
    const controller = new AbortController();
    void fetch("/api/storefront/shipping-addons", {
      method: "POST", headers: { "content-type": "application/json" }, signal: controller.signal,
      body: JSON.stringify({ locale, country, lines: lines.map(([variantId, quantity]) => ({ variantId, quantity })) }),
    }).then(async (response) => {
      if (!response.ok) throw new Error("unavailable");
      return response.json() as Promise<{ suggestions: Suggestion[] }>;
    }).then((result) => { setSuggestions(result.suggestions); setLoading(false); })
      .catch(() => { if (!controller.signal.aborted) { setError(true); setLoading(false); } });
    return () => controller.abort();
  }, [cartKey, country, locale]);

  const heading = locale === "nl" ? "Meepakkers voor gratis verzending" : locale === "en" ? "Add-ons for free shipping" : "Ajouts pour la livraison gratuite";
  return <section className="mt-5 rounded-card border border-border bg-surface p-4" aria-labelledby="shipping-addons-title">
    <h2 id="shipping-addons-title" className="font-heading text-heading-sm font-bold text-text">{heading}</h2>
    <p className="mt-1 text-body-sm text-muted">{locale === "nl" ? `Nog ${formatPrice(threshold - subtotalCents, locale)} tot gratis verzending. Deze voorstellen halen de grens met een kleine extra besteding.` : locale === "en" ? `Add ${formatPrice(threshold - subtotalCents, locale)} for free shipping.` : `Ajoutez ${formatPrice(threshold - subtotalCents, locale)} pour la livraison gratuite.`}</p>
    {loading ? <p className="mt-3 text-body-sm text-muted" role="status">{locale === "nl" ? "Passende producten zoeken…" : "Loading…"}</p> : null}
    {error ? <p className="mt-3 text-body-sm text-red-700" role="status">{locale === "nl" ? "Meepakkers zijn tijdelijk niet beschikbaar." : "Suggestions are temporarily unavailable."}</p> : null}
    {!loading && !error && suggestions.length === 0 ? <p className="mt-3 text-body-sm text-muted">{locale === "nl" ? "Er is nu geen passende meepakker met voldoende voorraad." : "No suitable add-on is available right now."}</p> : null}
    {suggestions.length > 0 ? <ul className="mt-4 grid gap-2 sm:grid-cols-2" aria-live="polite">{suggestions.map((suggestion) => <li key={suggestion.variantId} className="flex items-center gap-3 rounded-button border border-border p-2">
      {suggestion.imageUrl ? <img src={suggestion.imageUrl} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-full object-cover" /> : null}
      <div className="min-w-0 flex-1"><p className="truncate text-body-sm font-semibold text-text">{suggestion.name}</p><p className="text-xs text-muted">{suggestion.quantity} × {suggestion.variantLabel} · {formatPrice(suggestion.priceCents * suggestion.quantity, locale)}</p></div>
      <button type="button" onClick={() => { addCartItem({ variantId: suggestion.variantId, productId: suggestion.productId, slug: suggestion.slug, name: suggestion.name, variantLabel: suggestion.variantLabel, weightGrams: suggestion.weightGrams, priceCents: suggestion.priceCents, imageUrl: suggestion.imageUrl, locale }, suggestion.quantity); setAddedId(suggestion.variantId); }} className="min-h-11 shrink-0 rounded-button bg-accent px-3 text-xs font-bold text-contrast">{addedId === suggestion.variantId ? "✓" : locale === "nl" ? "Voeg toe" : "Add"}</button>
    </li>)}</ul> : null}
  </section>;
}
