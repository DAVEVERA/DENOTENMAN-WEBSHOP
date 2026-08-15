"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import { slugifyProduct } from "@/lib/admin-product-schema";

type CategoryOption = { id: string; name: string; parentId: string | null };
type ProductOption = { id: string; name: string };
type Variant = {
  clientKey: string;
  id?: string;
  sku: string;
  label: string;
  weightGrams: string;
  preparation: "RAW" | "ROASTED";
  salting: "UNSALTED" | "SALTED";
  coating: "NONE" | "CHOCOLATE" | "YOGHURT" | "FLAVORED";
  isActive: boolean;
  priceEuro: string;
  salePriceEuro: string;
  stock: string;
};
type ImageData = { id: string; url: string; alt: string; isPrimary: boolean; sortOrder: number };
type InitialProduct = {
  version?: string;
  sku: string;
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  basePriceEuro: string;
  salePriceEuro: string;
  unit: "WEIGHT" | "VOLUME";
  isActive: boolean;
  categoryIds: string[];
  recommendationIds: string[];
  variants: Variant[];
};

const inputClass = "mt-1 min-h-11 w-full rounded-button border border-border bg-white px-3 py-2 text-body-sm text-text";
const labelClass = "block text-body-sm font-semibold text-text";

function euroToCents(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  return /^\d+(?:\.\d{1,2})?$/.test(normalized) ? Math.round(Number(normalized) * 100) : null;
}

function integer(value: string, minimum: number): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum ? parsed : null;
}

export function createEmptyVariant(skuPrefix = ""): Variant {
  return { clientKey: crypto.randomUUID(), sku: skuPrefix ? `${skuPrefix}-` : "", label: "", weightGrams: "250", preparation: "RAW", salting: "UNSALTED", coating: "NONE", isActive: true, priceEuro: "0.00", salePriceEuro: "", stock: "0" };
}

export function ProductAdminForm({ mode, productId, initial, categories, productOptions, images: initialImages }: {
  mode: "create" | "edit";
  productId?: string;
  initial: InitialProduct;
  categories: CategoryOption[];
  productOptions: ProductOption[];
  images: ImageData[];
}) {
  const router = useRouter();
  const [product, setProduct] = useState(initial);
  const [images, setImages] = useState(initialImages);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const selectedMainId = product.categoryIds.find((id) => !categories.find((item) => item.id === id)?.parentId) ?? "";
  const selectedSubId = product.categoryIds.find((id) => Boolean(categories.find((item) => item.id === id)?.parentId)) ?? "";
  const mainCategories = categories.filter((item) => !item.parentId);
  const subCategories = categories.filter((item) => item.parentId === selectedMainId);
  const availableRecommendations = useMemo(() => productOptions.filter((item) => item.id !== productId), [productOptions, productId]);

  function setField<K extends keyof InitialProduct>(key: K, value: InitialProduct[K]) {
    setStatus("idle");
    setProduct((current) => ({ ...current, [key]: value }));
  }
  function setVariant(key: string, field: keyof Variant, value: Variant[keyof Variant]) {
    setStatus("idle");
    setProduct((current) => ({ ...current, variants: current.variants.map((variant) => variant.clientKey === key ? { ...variant, [field]: value } : variant) }));
  }

  async function saveProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setStatus("saving"); setMessage(null);
    const basePriceCents = euroToCents(product.basePriceEuro);
    const salePriceCents = product.salePriceEuro.trim() ? euroToCents(product.salePriceEuro) : null;
    if (basePriceCents === null || (product.salePriceEuro.trim() && salePriceCents === null)) { setStatus("error"); setMessage("Controleer de basis- en actieprijs."); return; }
    const variants = [];
    for (const variant of product.variants) {
      const priceCents = euroToCents(variant.priceEuro);
      const variantSale = variant.salePriceEuro.trim() ? euroToCents(variant.salePriceEuro) : null;
      const weightGrams = integer(variant.weightGrams, 1);
      const stock = integer(variant.stock, 0);
      if (!variant.sku.trim() || priceCents === null || (variant.salePriceEuro.trim() && variantSale === null) || weightGrams === null || stock === null) { setStatus("error"); setMessage(`Controleer alle velden van variant ${variant.sku || "zonder SKU"}.`); return; }
      variants.push({ id: variant.id, sku: variant.sku.trim(), label: variant.label.trim() || null, weightGrams, preparation: variant.preparation, salting: variant.salting, coating: variant.coating, isActive: variant.isActive, priceCents, salePriceCents: variantSale, stock });
    }
    const response = await fetch(mode === "create" ? "/api/admin/products" : `/api/admin/products/${productId}`, {
      method: mode === "create" ? "POST" : "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version: product.version, sku: product.sku.trim(), slug: product.slug.trim(), basePriceCents, salePriceCents, unit: product.unit, isActive: product.isActive, translation: { name: product.name.trim(), shortDescription: product.shortDescription.trim() || null, description: product.description.trim() || null }, categoryIds: product.categoryIds, recommendationIds: product.recommendationIds.filter(Boolean), variants }),
    });
    const body = await response.json().catch(() => null) as { productId?: string; version?: string; variants?: { id: string; sku: string }[]; error?: string; message?: string } | null;
    if (!response.ok) { setStatus("error"); setMessage(body?.error === "STALE_PRODUCT" ? "Dit product is intussen elders gewijzigd. Herlaad de pagina voordat je opnieuw opslaat." : body?.message ?? "Opslaan is niet gelukt. Controleer de invoer."); return; }
    if (mode === "create" && body?.productId) { router.push(`/admin/producten/${body.productId}`); return; }
    if (body?.version) setProduct((current) => ({
      ...current,
      version: body.version,
      variants: current.variants.map((variant) => ({ ...variant, id: body.variants?.find((saved) => saved.sku === variant.sku)?.id ?? variant.id })),
    }));
    setStatus("saved"); setMessage("Alle productinstellingen zijn opgeslagen."); router.refresh();
  }

  async function uploadImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file || !productId) return;
    setUploading(true); setMessage(null);
    const form = new FormData(); form.set("file", file); form.set("alt", product.name);
    const response = await fetch(`/api/admin/products/${productId}/images`, { method: "POST", body: form });
    if (!response.ok) { setStatus("error"); setMessage("Afbeelding uploaden is niet gelukt. Gebruik JPG, PNG, WebP of AVIF tot 8 MB."); }
    else {
      const body = await response.json() as { image: { id: string; url: string; alt: string | null; isPrimary: boolean; sortOrder: number } };
      setImages((current) => [...current, { ...body.image, alt: body.image.alt ?? "" }]);
      setStatus("saved"); setMessage("Afbeelding is veilig geüpload."); router.refresh();
    }
    setUploading(false); event.target.value = "";
  }
  async function saveImage(image: ImageData) {
    if (!productId) return;
    const response = await fetch(`/api/admin/products/${productId}/images/${image.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ alt: image.alt.trim() || null, sortOrder: image.sortOrder, isPrimary: image.isPrimary }) });
    setStatus(response.ok ? "saved" : "error"); setMessage(response.ok ? "Afbeeldingsinstellingen opgeslagen." : "Afbeelding opslaan is niet gelukt."); if (response.ok) router.refresh();
  }
  async function removeImage(image: ImageData) {
    if (!productId || !confirm("Deze afbeelding definitief verwijderen?")) return;
    const response = await fetch(`/api/admin/products/${productId}/images/${image.id}`, { method: "DELETE" });
    if (response.ok) { setImages((current) => current.filter((item) => item.id !== image.id)); setStatus("saved"); setMessage("Afbeelding verwijderd."); router.refresh(); }
    else { setStatus("error"); setMessage("Upload eerst een vervangende afbeelding; de laatste afbeelding blijft beschermd."); }
  }

  return <form onSubmit={saveProduct} className="space-y-6 pb-28">
    <section className="rounded-panel border border-border bg-surface p-4 shadow-card sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-heading-md text-text">Productgegevens</h2><p className="mt-1 text-body-sm text-muted">Naam, vindbaarheid, eenheid en zichtbaarheid.</p></div><button type="button" onClick={() => setField("isActive", !product.isActive)} className={`min-h-11 rounded-full px-4 text-body-sm font-semibold ${product.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`} aria-pressed={product.isActive}>{product.isActive ? "Actief — klik om uit te zetten" : "Inactief — klik om te activeren"}</button></div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className={labelClass}>Productnaam (NL)<input value={product.name} onChange={(e) => setField("name", e.target.value)} className={inputClass} required /></label>
        <label className={labelClass}>Product-SKU<input value={product.sku} onChange={(e) => setField("sku", e.target.value)} className={inputClass} required /></label>
        <label className={`${labelClass} md:col-span-2`}>Slug<div className="mt-1 flex flex-col gap-2 sm:flex-row"><input value={product.slug} onChange={(e) => setField("slug", e.target.value)} className="min-h-11 min-w-0 flex-1 rounded-button border border-border px-3 py-2 text-body-sm" required /><button type="button" onClick={() => setField("slug", slugifyProduct(product.name))} className="min-h-11 rounded-button border border-border px-4 font-semibold">Maak van naam</button></div></label>
        <label className={`${labelClass} md:col-span-2`}>Korte omschrijving <span className="font-normal text-muted">({product.shortDescription.length}/220)</span><textarea value={product.shortDescription} onChange={(e) => setField("shortDescription", e.target.value.slice(0, 220))} rows={3} className={inputClass} /></label>
        <label className={`${labelClass} md:col-span-2`}>Volledige omschrijving<textarea value={product.description} onChange={(e) => setField("description", e.target.value)} rows={8} className={inputClass} /></label>
      </div>
    </section>

    <section className="rounded-panel border border-border bg-surface p-4 shadow-card sm:p-6"><h2 className="text-heading-md text-text">Prijs en indeling</h2><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <label className={labelClass}>Normale basisprijs (€)<input inputMode="decimal" value={product.basePriceEuro} onChange={(e) => setField("basePriceEuro", e.target.value)} className={inputClass} /></label>
      <label className={labelClass}>Actieprijs (€) <span className="font-normal text-muted">optioneel</span><input inputMode="decimal" value={product.salePriceEuro} onChange={(e) => setField("salePriceEuro", e.target.value)} className={inputClass} /></label>
      <label className={labelClass}>Eenheid<select value={product.unit} onChange={(e) => setField("unit", e.target.value as InitialProduct["unit"])} className={inputClass}><option value="WEIGHT">Gewicht (gram)</option><option value="VOLUME">Inhoud (ml)</option></select></label>
      <label className={labelClass}>Hoofdcategorie<select value={selectedMainId} onChange={(e) => setField("categoryIds", e.target.value ? [e.target.value] : [])} className={inputClass}><option value="">Geen</option>{mainCategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className={labelClass}>Subcategorie<select value={selectedSubId} onChange={(e) => setField("categoryIds", [selectedMainId, e.target.value].filter(Boolean))} disabled={!selectedMainId} className={inputClass}><option value="">Geen</option>{subCategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    </div></section>

    <section className="rounded-panel border border-border bg-surface p-4 shadow-card sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-heading-md text-text">Varianten en subvarianten</h2><p className="mt-1 text-body-sm text-muted">Prijs, actieprijs, hoeveelheid en status zijn per variant instelbaar.</p></div><button type="button" onClick={() => setField("variants", [...product.variants, createEmptyVariant(product.sku)])} className="inline-flex min-h-11 items-center gap-2 rounded-button bg-accent px-4 font-semibold text-contrast"><Plus className="h-4 w-4" />Variant toevoegen</button></div>
      <div className="mt-5 grid gap-4">{product.variants.map((variant, index) => <article key={variant.clientKey} className="rounded-card border border-border bg-background p-4"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-heading-sm">Variant {index + 1}</h3><button type="button" onClick={() => setVariant(variant.clientKey, "isActive", !variant.isActive)} className={`min-h-11 rounded-full px-4 text-body-sm font-semibold ${variant.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`} aria-pressed={variant.isActive}>{variant.isActive ? "Actief" : "Inactief"}</button></div><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className={labelClass}>SKU<input value={variant.sku} onChange={(e) => setVariant(variant.clientKey, "sku", e.target.value)} className={inputClass} /></label><label className={labelClass}>Label<input value={variant.label} onChange={(e) => setVariant(variant.clientKey, "label", e.target.value)} className={inputClass} placeholder={`${variant.weightGrams} ${product.unit === "VOLUME" ? "ml" : "g"}`} /></label><label className={labelClass}>{product.unit === "VOLUME" ? "Hoeveelheid (ml)" : "Gewicht (gram)"}<input inputMode="numeric" value={variant.weightGrams} onChange={(e) => setVariant(variant.clientKey, "weightGrams", e.target.value)} className={inputClass} /></label><label className={labelClass}>Voorraad<input inputMode="numeric" value={variant.stock} onChange={(e) => setVariant(variant.clientKey, "stock", e.target.value)} className={inputClass} /></label>
        <label className={labelClass}>Normale prijs (€)<input inputMode="decimal" value={variant.priceEuro} onChange={(e) => setVariant(variant.clientKey, "priceEuro", e.target.value)} className={inputClass} /></label><label className={labelClass}>Actieprijs (€)<input inputMode="decimal" value={variant.salePriceEuro} onChange={(e) => setVariant(variant.clientKey, "salePriceEuro", e.target.value)} className={inputClass} /></label><label className={labelClass}>Bereiding<select value={variant.preparation} onChange={(e) => setVariant(variant.clientKey, "preparation", e.target.value)} className={inputClass}><option value="RAW">Rauw</option><option value="ROASTED">Gebrand</option></select></label><label className={labelClass}>Zout<select value={variant.salting} onChange={(e) => setVariant(variant.clientKey, "salting", e.target.value)} className={inputClass}><option value="UNSALTED">Ongezouten</option><option value="SALTED">Gezouten</option></select></label><label className={labelClass}>Coating<select value={variant.coating} onChange={(e) => setVariant(variant.clientKey, "coating", e.target.value)} className={inputClass}><option value="NONE">Geen</option><option value="CHOCOLATE">Chocolade</option><option value="YOGHURT">Yoghurt</option><option value="FLAVORED">Gearomatiseerd</option></select></label>
      </div></article>)}</div>
    </section>

    <section className="rounded-panel border border-border bg-surface p-4 shadow-card sm:p-6"><h2 className="text-heading-md text-text">Meepakkers</h2><p className="mt-1 text-body-sm text-muted">Kies maximaal drie aanvullende producten voor de productdetailpagina.</p><div className="mt-4 grid gap-3 md:grid-cols-3">{[0, 1, 2].map((index) => <label key={index} className={labelClass}>Meepakker {index + 1}<select value={product.recommendationIds[index] ?? ""} onChange={(e) => { const next = [...product.recommendationIds]; next[index] = e.target.value; setField("recommendationIds", next); }} className={inputClass}><option value="">Geen</option>{availableRecommendations.map((item) => <option key={item.id} value={item.id} disabled={product.recommendationIds.some((value, selectedIndex) => selectedIndex !== index && value === item.id)}>{item.name}</option>)}</select></label>)}</div></section>

    {mode === "edit" ? <section className="rounded-panel border border-border bg-surface p-4 shadow-card sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-heading-md text-text">Productafbeeldingen</h2><p className="mt-1 text-body-sm text-muted">Upload, wijzig alt-tekst, volgorde en primaire foto.</p></div><label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-button bg-accent px-4 font-semibold text-contrast"><ImagePlus className="h-4 w-4" />{uploading ? "Uploaden…" : "Afbeelding uploaden"}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={uploadImage} disabled={uploading} className="sr-only" /></label></div><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{images.map((image) => <article key={image.id} className="rounded-card border border-border p-3"><img src={image.url} alt={image.alt || product.name} className="aspect-square w-full rounded-button bg-background object-contain" /><label className={`${labelClass} mt-3`}>Alt-tekst<input value={image.alt} onChange={(e) => setImages((items) => items.map((item) => item.id === image.id ? { ...item, alt: e.target.value } : item))} className={inputClass} /></label><label className={`${labelClass} mt-3`}>Volgorde<input type="number" min="0" value={image.sortOrder} onChange={(e) => setImages((items) => items.map((item) => item.id === image.id ? { ...item, sortOrder: Number(e.target.value) } : item))} className={inputClass} /></label><label className="mt-3 flex min-h-11 items-center gap-2 text-body-sm font-semibold"><input type="radio" name="primaryImage" checked={image.isPrimary} onChange={() => setImages((items) => items.map((item) => ({ ...item, isPrimary: item.id === image.id })))} />Primaire afbeelding</label><div className="mt-3 flex gap-2"><button type="button" onClick={() => saveImage(image)} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-button border border-border font-semibold"><Save className="h-4 w-4" />Opslaan</button><button type="button" onClick={() => removeImage(image)} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-button border border-red-200 text-red-700" aria-label="Afbeelding verwijderen"><Trash2 className="h-4 w-4" /></button></div></article>)}</div></section> : null}

    {mode === "edit" ? <div className="grid gap-3 sm:grid-cols-2"><a href={`/admin/producten/${productId}/audit`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-button border border-accent bg-surface px-4 font-semibold text-text"><Sparkles className="h-5 w-5 text-accent-hover" />AI, SEO en vindbaarheidscontrole</a><a href={`/admin/advertenties?product=${productId}`} className="inline-flex min-h-12 items-center justify-center rounded-button border border-border bg-surface px-4 font-semibold text-text">Google Ads-instellingen</a></div> : null}
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 p-3 shadow-[0_-8px_24px_rgba(20,20,20,.12)] backdrop-blur sm:sticky sm:bottom-3 sm:rounded-panel sm:border"><div className="mx-auto flex max-w-6xl flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between"><p role="status" aria-live="polite" className={`text-body-sm ${status === "error" ? "text-red-700" : status === "saved" ? "text-green-700" : "text-muted"}`}>{status === "saving" ? "Veilig opslaan…" : message ?? "Nog niet opgeslagen wijzigingen blijven lokaal in dit formulier."}</p><button type="submit" disabled={status === "saving"} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-button bg-accent px-6 font-heading font-bold text-contrast shadow-button disabled:opacity-60"><Save className="h-5 w-5" />{mode === "create" ? "Product aanmaken" : "Alles opslaan"}</button></div></div>
  </form>;
}

export type { CategoryOption, ProductOption, Variant, ImageData, InitialProduct };
