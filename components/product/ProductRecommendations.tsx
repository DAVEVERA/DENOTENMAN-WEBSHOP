"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Plus } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import type { ProductRecommendationDto } from "@/lib/queries";
import { product as productPath } from "@/lib/routes";
import { formatPrice } from "@/lib/format";
import { addCartItem } from "@/lib/storefront-state";

const copy = { nl: { title: "Lekker om mee te pakken", add: "Snel toevoegen", added: "Toegevoegd", view: "Bekijk product" }, en: { title: "Perfect additions", add: "Quick add", added: "Added", view: "View product" }, fr: { title: "À ajouter à votre panier", add: "Ajout rapide", added: "Ajouté", view: "Voir le produit" } } as const;

export function ProductRecommendations({ items, locale }: { items: ProductRecommendationDto[]; locale: Locale }) {
  const [addedId, setAddedId] = useState<string | null>(null);
  if (!items.length) return null;
  const labels = copy[locale];
  return <section className="border-t border-border pt-7 lg:col-span-2" aria-labelledby="recommendations-title">
    <h2 id="recommendations-title" className="text-heading-md text-text">{labels.title}</h2>
    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">{items.map((item) => <article key={item.id} className="grid grid-cols-[92px_minmax(0,1fr)] gap-3 rounded-card border border-border bg-white p-3 sm:grid-cols-1">
      {item.image ? <img src={item.image.url} alt={item.image.alt ?? item.name} className="aspect-square w-full rounded-full bg-background object-cover" /> : <span className="aspect-square rounded-full bg-background" />}
      <div className="min-w-0"><h3 className="line-clamp-2 font-heading text-heading-sm font-bold text-text">{item.name}</h3>{item.variant ? <p className="mt-1 font-semibold text-text">{formatPrice(item.variant.priceCents, locale)}</p> : null}<div className="mt-3 grid gap-2"><button type="button" disabled={!item.variant} onClick={() => { if (!item.variant) return; addCartItem({ variantId: item.variant.id, productId: item.id, slug: item.slug, name: item.name, variantLabel: item.variant.label ?? `${item.variant.weightGrams} g`, priceCents: item.variant.priceCents, imageUrl: item.image?.url ?? null, locale }, 1); setAddedId(item.id); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-button bg-accent px-3 text-body-sm font-bold text-contrast disabled:opacity-50">{addedId === item.id ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{addedId === item.id ? labels.added : labels.add}</button><Link href={productPath(locale, item.slug)} className="text-center text-body-sm font-semibold text-accent-hover underline underline-offset-4">{labels.view}</Link></div></div>
    </article>)}</div>
  </section>;
}
