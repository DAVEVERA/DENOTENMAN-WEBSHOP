"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { EyeOff, Globe2, Loader2, Plus, Save, Sparkles } from "lucide-react";
import { slugifyProduct } from "@/lib/admin-product-schema";
import {
  ProductTranslationsEditor,
  type ProductLocale,
  type ProductTranslationDraft,
} from "@/components/admin-panel/ProductTranslationsEditor";
import {
  NutritionEditor,
  emptyNutritionValues,
  type NutritionValues,
} from "@/components/admin-panel/NutritionEditor";
import { ProductImageStudio } from "@/components/admin-panel/ProductImageStudio";

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
type CategoryAssignment = { categoryId: string; isPrimary: boolean; sortOrder: number };
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
  translations?: Record<ProductLocale, ProductTranslationDraft>;
  nutrition?: NutritionValues;
  categories?: CategoryAssignment[];
  imageOrder?: { imageId: string; sortOrder: number; isPrimary: boolean }[];
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

function emptyTranslation(locale: ProductLocale): ProductTranslationDraft {
  return { locale, slug: "", name: "", shortDescription: "", description: "", descriptionHtml: "", seoTitle: "", metaDescription: "", promotionText: "" };
}

function initialTranslations(initial: InitialProduct): Record<ProductLocale, ProductTranslationDraft> {
  return {
    nl: initial.translations?.nl ?? { ...emptyTranslation("nl"), slug: initial.slug, name: initial.name, shortDescription: initial.shortDescription, description: initial.description },
    en: initial.translations?.en ?? emptyTranslation("en"),
    fr: initial.translations?.fr ?? emptyTranslation("fr"),
  };
}

function plainTextFromHtml(html: string): string {
  if (!html.trim()) return "";
  const element = document.createElement("div");
  element.innerHTML = html;
  return element.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

export function productSaveErrorMessage(cause: unknown): string {
  if (cause && typeof cause === "object") {
    const payload = cause as { error?: unknown; message?: unknown };
    if (payload.error === "STALE_PRODUCT") {
      return "Dit product is intussen elders gewijzigd. Herlaad de pagina voordat je opnieuw opslaat.";
    }
    if (typeof payload.message === "string" && payload.message.trim() && !(cause instanceof TypeError)) {
      return payload.message.trim().slice(0, 240);
    }
  }
  if (cause instanceof TypeError) {
    return "Geen verbinding met de server. Controleer je internetverbinding en probeer opnieuw.";
  }
  return "Opslaan is niet gelukt. Controleer de invoer en probeer opnieuw.";
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
  const [translations, setTranslations] = useState(() => initialTranslations(initial));
  const [nutrition, setNutrition] = useState<NutritionValues>(() => initial.nutrition ?? emptyNutritionValues());
  const [categoryAssignments, setCategoryAssignments] = useState<CategoryAssignment[]>(
    () => initial.categories ?? initial.categoryIds.map((categoryId, index) => ({ categoryId, isPrimary: index === 0, sortOrder: index }))
  );
  const [categoryPlacementMode, setCategoryPlacementMode] = useState<"auto" | "manual">(mode === "create" ? "auto" : "manual");
  const [images, setImages] = useState(initialImages);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [visibilityStatus, setVisibilityStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [visibilityMessage, setVisibilityMessage] = useState<string | null>(null);

  const selectedMainId = categoryAssignments.find((item) => !categories.find((category) => category.id === item.categoryId)?.parentId)?.categoryId ?? "";
  const selectedSubId = categoryAssignments.find((item) => categories.find((category) => category.id === item.categoryId)?.parentId === selectedMainId)?.categoryId ?? "";
  const selectedGroupId = categoryAssignments.find((item) => categories.find((category) => category.id === item.categoryId)?.parentId === selectedSubId)?.categoryId ?? "";
  const primaryCategory = categoryAssignments.find((item) => item.isPrimary) ?? categoryAssignments[0];
  const mainCategories = categories.filter((item) => !item.parentId);
  const subCategories = categories.filter((item) => item.parentId === selectedMainId);
  const productGroups = categories.filter((item) => item.parentId === selectedSubId);
  const availableRecommendations = useMemo(() => productOptions.filter((item) => item.id !== productId), [productOptions, productId]);

  function setField<K extends keyof InitialProduct>(key: K, value: InitialProduct[K]) {
    setStatus("idle");
    setProduct((current) => ({ ...current, [key]: value }));
  }
  function setVariant(key: string, field: keyof Variant, value: Variant[keyof Variant]) {
    setStatus("idle");
    setProduct((current) => ({ ...current, variants: current.variants.map((variant) => variant.clientKey === key ? { ...variant, [field]: value } : variant) }));
  }

  async function updateVisibility() {
    const nextIsActive = !product.isActive;
    setVisibilityMessage(null);

    if (mode === "create") {
      setField("isActive", nextIsActive);
      setVisibilityStatus("idle");
      return;
    }
    if (!productId || !product.version) {
      setVisibilityStatus("error");
      setVisibilityMessage("De productversie ontbreekt. Herlaad de pagina en probeer opnieuw.");
      return;
    }

    setVisibilityStatus("saving");
    try {
      const response = await fetch(`/api/admin/products/${productId}/visibility`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: nextIsActive, version: product.version }),
      });
      const body = await response.json().catch(() => null) as {
        isActive?: boolean;
        version?: string;
        frontendSynced?: boolean;
        error?: string;
        message?: string;
      } | null;
      if (!response.ok || typeof body?.isActive !== "boolean" || !body.version) {
        setVisibilityStatus("error");
        setVisibilityMessage(productSaveErrorMessage(body));
        return;
      }

      setProduct((current) => ({
        ...current,
        isActive: body.isActive as boolean,
        version: body.version,
      }));
      if (body.frontendSynced === false) {
        setVisibilityStatus("error");
        setVisibilityMessage("De status is opgeslagen, maar de webshop kon niet direct worden vernieuwd. Gebruik ‘Alles opslaan’ om opnieuw te synchroniseren.");
      } else {
        setVisibilityStatus("saved");
        setVisibilityMessage(
          body.isActive
            ? "Product staat nu online en is zichtbaar in de webshop."
            : "Product staat nu offline en is niet zichtbaar in de webshop."
        );
      }
      router.refresh();
    } catch (cause) {
      setVisibilityStatus("error");
      setVisibilityMessage(productSaveErrorMessage(cause));
    }
  }

  function updateTranslation(locale: ProductLocale, value: ProductTranslationDraft) {
    setStatus("idle");
    setTranslations((current) => ({ ...current, [locale]: value }));
    if (locale === "nl") {
      setProduct((current) => ({
        ...current,
        slug: value.slug,
        name: value.name,
        shortDescription: value.shortDescription,
        description: value.description,
      }));
    }
  }

  function setCategorySelection(mainId: string, subId = "", groupId = "") {
    const ids = [mainId, subId, groupId].filter(Boolean);
    const primaryId = groupId || subId || mainId;
    const next = ids.map((categoryId, index) => {
      const previous = categoryAssignments.find((item) => item.categoryId === categoryId);
      return {
        categoryId,
        isPrimary: categoryId === primaryId,
        sortOrder: previous?.sortOrder ?? index,
      };
    });
    setCategoryAssignments(next);
    setField("categoryIds", ids);
  }

  async function saveProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setStatus("saving"); setMessage(null);
    if (visibilityStatus === "saving") {
      setStatus("error");
      setMessage("Wacht tot de productstatus is bijgewerkt en sla daarna opnieuw op.");
      return;
    }
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
    const localizedContent = (["nl", "en", "fr"] as const)
      .map((locale) => translations[locale])
      .filter((translation) =>
        translation.locale === "nl" ||
        Object.entries(translation).some(([key, value]) => key !== "locale" && value.trim())
      )
      .map((translation) => ({
        ...translation,
        slug: translation.slug.trim(),
        name: translation.name.trim(),
        shortDescription: translation.shortDescription.trim() || null,
        description: (translation.description.trim() || plainTextFromHtml(translation.descriptionHtml)) || null,
        descriptionHtml: translation.descriptionHtml.trim() || null,
        seoTitle: translation.seoTitle.trim() || null,
        metaDescription: translation.metaDescription.trim() || null,
        promotionText: translation.promotionText.trim() || null,
      }));
    if (localizedContent.some((translation) => !translation.slug || !translation.name)) {
      setStatus("error");
      setMessage("Elke ingevulde taal heeft een productnaam en slug nodig.");
      return;
    }
    try {
      const response = await fetch(mode === "create" ? "/api/admin/products" : `/api/admin/products/${productId}`, {
        method: mode === "create" ? "POST" : "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: product.version,
          sku: product.sku.trim(),
          slug: translations.nl.slug.trim(),
          basePriceCents,
          salePriceCents,
          unit: product.unit,
          isActive: product.isActive,
          translations: localizedContent,
          nutrition,
          categories: categoryAssignments,
          categoryPlacementMode,
          recommendationIds: product.recommendationIds.filter(Boolean),
          variants,
        }),
      });
      const body = await response.json().catch(() => null) as { productId?: string; version?: string; variants?: { id: string; sku: string }[]; frontendSynced?: boolean; error?: string; message?: string } | null;
      if (!response.ok) { setStatus("error"); setMessage(productSaveErrorMessage(body)); return; }
      if (mode === "create" && body?.productId) { router.push(`/admin/producten/${body.productId}`); return; }
      if (body?.version) setProduct((current) => ({
        ...current,
        version: body.version,
        variants: current.variants.map((variant) => ({ ...variant, id: body.variants?.find((saved) => saved.sku === variant.sku)?.id ?? variant.id })),
      }));
      if (body?.frontendSynced === false) {
        setStatus("error");
        setMessage("Het product is opgeslagen, maar de webshop kon niet direct worden vernieuwd. Klik opnieuw op ‘Alles opslaan’ om de synchronisatie te herhalen.");
        return;
      }
      setStatus("saved"); setMessage("Alle productinstellingen zijn opgeslagen."); router.refresh();
    } catch (cause) {
      setStatus("error");
      setMessage(productSaveErrorMessage(cause));
    }
  }

  return <form onSubmit={saveProduct} className="space-y-6 pb-28">
    <section
      className={`rounded-panel border-2 p-4 shadow-card sm:p-6 ${
        product.isActive
          ? "border-green-300 bg-green-50"
          : "border-red-300 bg-red-50"
      }`}
      aria-labelledby="product-visibility-heading"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={`mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
              product.isActive ? "bg-green-700 text-white" : "bg-red-700 text-white"
            }`}
            aria-hidden="true"
          >
            {product.isActive ? <Globe2 className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-heading text-muted">Leidende productstatus</p>
            <h2 id="product-visibility-heading" className="mt-1 text-heading-md text-text">
              {product.isActive ? "Online zichtbaar" : "Niet zichtbaar in de webshop"}
            </h2>
            <p id="product-visibility-description" className="mt-1 max-w-2xl text-body-sm text-muted">
              Deze hoofdstatus bepaalt of het hele product online staat. Variantstatussen bepalen alleen welke verpakkingen bestelbaar zijn.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={updateVisibility}
          disabled={visibilityStatus === "saving" || status === "saving"}
          aria-pressed={product.isActive}
          aria-describedby="product-visibility-description"
          className={`inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-button px-5 font-heading text-body-sm font-bold text-white shadow-button transition-colors disabled:cursor-wait disabled:opacity-60 ${
            product.isActive
              ? "bg-red-700 hover:bg-red-800"
              : "bg-green-700 hover:bg-green-800"
          }`}
        >
          {visibilityStatus === "saving" ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
          {visibilityStatus === "saving"
            ? "Status bijwerken…"
            : product.isActive
              ? "Product offline zetten"
              : "Product online zetten"}
        </button>
      </div>
      <p
        role="status"
        aria-live="polite"
        className={`mt-3 text-body-sm font-semibold ${
          visibilityStatus === "error"
            ? "text-red-800"
            : visibilityStatus === "saved"
              ? product.isActive
                ? "text-green-800"
                : "text-red-800"
              : "text-muted"
        }`}
      >
        {visibilityMessage ?? (mode === "edit"
          ? "Zichtbaarheid wordt met deze knop direct opgeslagen. Andere wijzigingen pas met ‘Alles opslaan’."
          : "Deze keuze wordt opgeslagen zodra je het product aanmaakt.")}
      </p>
    </section>
    <section className="rounded-panel border border-border bg-surface p-4 shadow-card sm:p-6">
      <div><h2 className="text-heading-md text-text">Basisgegevens</h2><p className="mt-1 text-body-sm text-muted">Interne SKU en algemene productgegevens.</p></div>
      <label className={`${labelClass} mt-5 max-w-xl`}>Product-SKU<input value={product.sku} onChange={(e) => setField("sku", e.target.value)} className={inputClass} required /></label>
    </section>

    <ProductTranslationsEditor
      translations={translations}
      onChange={updateTranslation}
      onSlugFromName={(locale) => updateTranslation(locale, { ...translations[locale], slug: slugifyProduct(translations[locale].name) })}
    />

    <section className="rounded-panel border border-border bg-surface p-4 shadow-card sm:p-6"><h2 className="text-heading-md text-text">Prijs en indeling</h2><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <label className={labelClass}>Normale basisprijs (€)<input inputMode="decimal" value={product.basePriceEuro} onChange={(e) => setField("basePriceEuro", e.target.value)} className={inputClass} /></label>
      <label className={labelClass}>Actieprijs (€) <span className="font-normal text-muted">optioneel</span><input inputMode="decimal" value={product.salePriceEuro} onChange={(e) => setField("salePriceEuro", e.target.value)} className={inputClass} /></label>
      <label className={labelClass}>Eenheid<select value={product.unit} onChange={(e) => setField("unit", e.target.value as InitialProduct["unit"])} className={inputClass}><option value="WEIGHT">Gewicht (gram)</option><option value="VOLUME">Inhoud (ml)</option></select></label>
      <label className={labelClass}>Hoofdcategorie<select value={selectedMainId} onChange={(e) => setCategorySelection(e.target.value)} className={inputClass}><option value="">Geen</option>{mainCategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className={labelClass}>Subcategorie<select value={selectedSubId} onChange={(e) => setCategorySelection(selectedMainId, e.target.value)} disabled={!selectedMainId} className={inputClass}><option value="">Geen</option>{subCategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className={labelClass}>Productgroep<select value={selectedGroupId} onChange={(e) => setCategorySelection(selectedMainId, selectedSubId, e.target.value)} disabled={!selectedSubId} className={inputClass}><option value="">Geen</option>{productGroups.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className={labelClass}>Plaatsing<select value={categoryPlacementMode} onChange={(e) => setCategoryPlacementMode(e.target.value as typeof categoryPlacementMode)} className={inputClass}><option value="auto">Slim automatisch achteraan</option><option value="manual">Handmatige positie</option></select><span className="mt-1 block font-normal text-muted">Automatisch voorkomt dat een nieuw product boven bestaande producten terechtkomt.</span></label>
      <label className={labelClass}>Positie binnen productgroep<input type="number" min="0" value={primaryCategory?.sortOrder ?? 0} disabled={categoryPlacementMode === "auto"} onChange={(e) => setCategoryAssignments((items) => items.map((item) => item.isPrimary ? { ...item, sortOrder: Math.max(0, Number(e.target.value) || 0) } : item))} className={inputClass} /><span className="mt-1 block font-normal text-muted">Lager staat eerder; kies handmatig om dit veld te wijzigen.</span></label>
    </div></section>

    <NutritionEditor values={nutrition} onChange={(values) => { setNutrition(values); setStatus("idle"); }} unit={product.unit} />

    <section className="rounded-panel border border-border bg-surface p-4 shadow-card sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-heading-md text-text">Varianten en subvarianten</h2><p className="mt-1 text-body-sm text-muted">Prijs en voorraad zijn per variant instelbaar. Een variantstatus bepaalt alleen of die verpakking bestelbaar is; de hoofdstatus bovenaan bepaalt productzichtbaarheid.</p></div><button type="button" onClick={() => setField("variants", [...product.variants, createEmptyVariant(product.sku)])} className="inline-flex min-h-11 items-center gap-2 rounded-button bg-accent px-4 font-semibold text-contrast"><Plus className="h-4 w-4" />Variant toevoegen</button></div>
      <div className="mt-5 grid gap-4">{product.variants.map((variant, index) => <article key={variant.clientKey} className="rounded-card border border-border bg-background p-4"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-heading-sm">Variant {index + 1}</h3><button type="button" onClick={() => setVariant(variant.clientKey, "isActive", !variant.isActive)} className={`min-h-11 rounded-full px-4 text-body-sm font-semibold ${variant.isActive ? "bg-green-100 text-green-800" : "bg-border text-muted"}`} aria-pressed={variant.isActive}>{variant.isActive ? "Bestelbaar" : "Niet bestelbaar"}</button></div><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className={labelClass}>SKU<input value={variant.sku} onChange={(e) => setVariant(variant.clientKey, "sku", e.target.value)} className={inputClass} /></label><label className={labelClass}>Label<input value={variant.label} onChange={(e) => setVariant(variant.clientKey, "label", e.target.value)} className={inputClass} placeholder={`${variant.weightGrams} ${product.unit === "VOLUME" ? "ml" : "g"}`} /></label><label className={labelClass}>{product.unit === "VOLUME" ? "Hoeveelheid (ml)" : "Gewicht (gram)"}<input inputMode="numeric" value={variant.weightGrams} onChange={(e) => setVariant(variant.clientKey, "weightGrams", e.target.value)} className={inputClass} /></label><label className={labelClass}>Voorraad<input inputMode="numeric" value={variant.stock} onChange={(e) => setVariant(variant.clientKey, "stock", e.target.value)} className={inputClass} /></label>
        <label className={labelClass}>Normale prijs (€)<input inputMode="decimal" value={variant.priceEuro} onChange={(e) => setVariant(variant.clientKey, "priceEuro", e.target.value)} className={inputClass} /></label><label className={labelClass}>Actieprijs (€)<input inputMode="decimal" value={variant.salePriceEuro} onChange={(e) => setVariant(variant.clientKey, "salePriceEuro", e.target.value)} className={inputClass} /></label><label className={labelClass}>Bereiding<select value={variant.preparation} onChange={(e) => setVariant(variant.clientKey, "preparation", e.target.value)} className={inputClass}><option value="RAW">Rauw</option><option value="ROASTED">Gebrand</option></select></label><label className={labelClass}>Zout<select value={variant.salting} onChange={(e) => setVariant(variant.clientKey, "salting", e.target.value)} className={inputClass}><option value="UNSALTED">Ongezouten</option><option value="SALTED">Gezouten</option></select></label><label className={labelClass}>Coating<select value={variant.coating} onChange={(e) => setVariant(variant.clientKey, "coating", e.target.value)} className={inputClass}><option value="NONE">Geen</option><option value="CHOCOLATE">Chocolade</option><option value="YOGHURT">Yoghurt</option><option value="FLAVORED">Gearomatiseerd</option></select></label>
      </div></article>)}</div>
    </section>

    <section className="rounded-panel border border-border bg-surface p-4 shadow-card sm:p-6"><h2 className="text-heading-md text-text">Meepakkers</h2><p className="mt-1 text-body-sm text-muted">Kies maximaal drie aanvullende producten voor de productdetailpagina.</p><div className="mt-4 grid gap-3 md:grid-cols-3">{[0, 1, 2].map((index) => <label key={index} className={labelClass}>Meepakker {index + 1}<select value={product.recommendationIds[index] ?? ""} onChange={(e) => { const next = [...product.recommendationIds]; next[index] = e.target.value; setField("recommendationIds", next); }} className={inputClass}><option value="">Geen</option>{availableRecommendations.map((item) => <option key={item.id} value={item.id} disabled={product.recommendationIds.some((value, selectedIndex) => selectedIndex !== index && value === item.id)}>{item.name}</option>)}</select></label>)}</div></section>

    {mode === "edit" && productId ? (
      <ProductImageStudio
        productId={productId}
        productName={translations.nl.name || product.name}
        initialImages={images}
        onImagesChange={(next) => setImages(next.map((image) => ({ ...image, alt: image.alt ?? "" })))}
      />
    ) : null}

    {mode === "edit" ? <div className="grid gap-3 sm:grid-cols-2"><a href={`/admin/producten/${productId}/audit`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-button border border-accent bg-surface px-4 font-semibold text-text"><Sparkles className="h-5 w-5 text-accent-hover" />AI, SEO en vindbaarheidscontrole</a><a href={`/admin/advertenties?product=${productId}`} className="inline-flex min-h-12 items-center justify-center rounded-button border border-border bg-surface px-4 font-semibold text-text">Google Ads-instellingen</a></div> : null}
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 p-3 shadow-[0_-8px_24px_rgba(20,20,20,.12)] backdrop-blur sm:sticky sm:bottom-3 sm:rounded-panel sm:border"><div className="mx-auto flex max-w-6xl flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between"><p role="status" aria-live="polite" className={`text-body-sm ${status === "error" ? "text-red-700" : status === "saved" ? "text-green-700" : "text-muted"}`}>{status === "saving" ? "Veilig opslaan en webshop vernieuwen…" : message ?? "Nog niet opgeslagen wijzigingen blijven lokaal in dit formulier."}</p><button type="submit" disabled={status === "saving" || visibilityStatus === "saving"} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-button bg-accent px-6 font-heading font-bold text-contrast shadow-button disabled:opacity-60"><Save className="h-5 w-5" />{mode === "create" ? "Product aanmaken" : "Alles opslaan"}</button></div></div>
  </form>;
}

export type { CategoryOption, ProductOption, Variant, ImageData, InitialProduct };
