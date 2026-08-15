"use client";

import { useState } from "react";
import { Languages } from "lucide-react";
import { RichTextEditor } from "@/components/admin-panel/RichTextEditor";

export type ProductLocale = "nl" | "en" | "fr";
export type ProductTranslationDraft = {
  locale: ProductLocale;
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  descriptionHtml: string;
  seoTitle: string;
  metaDescription: string;
  promotionText: string;
};

const localeLabels: Record<ProductLocale, string> = {
  nl: "Nederlands",
  en: "Engels",
  fr: "Frans",
};

const inputClass = "mt-1 min-h-11 w-full rounded-button border border-border bg-white px-3 py-2 text-body-sm text-text";
const labelClass = "block text-body-sm font-semibold text-text";

function translationStatus(translation: ProductTranslationDraft): "empty" | "partial" | "complete" {
  const values = [
    translation.name,
    translation.shortDescription,
    translation.descriptionHtml || translation.description,
    translation.seoTitle,
    translation.metaDescription,
  ];
  const filled = values.filter((value) => value.trim()).length;
  if (filled === 0) return "empty";
  return filled === values.length ? "complete" : "partial";
}

export function ProductTranslationsEditor({
  translations,
  onChange,
  onSlugFromName,
}: {
  translations: Record<ProductLocale, ProductTranslationDraft>;
  onChange: (locale: ProductLocale, value: ProductTranslationDraft) => void;
  onSlugFromName: (locale: ProductLocale) => void;
}) {
  const [activeLocale, setActiveLocale] = useState<ProductLocale>("nl");
  const current = translations[activeLocale];
  const status = translationStatus(current);

  function setField<K extends keyof ProductTranslationDraft>(
    key: K,
    value: ProductTranslationDraft[K]
  ) {
    onChange(activeLocale, { ...current, [key]: value });
  }

  return (
    <section className="rounded-panel border border-border bg-surface p-4 shadow-card sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-heading-md text-text">
            <Languages className="h-5 w-5 text-accent-hover" aria-hidden="true" />
            Teksten en vindbaarheid
          </h2>
          <p className="mt-1 text-body-sm text-muted">
            Bewerk Nederlands, Engels en Frans afzonderlijk. Ontbrekende talen blijven zichtbaar als status.
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="Producttaal">
        {(["nl", "en", "fr"] as const).map((locale) => {
          const localeStatus = translationStatus(translations[locale]);
          return (
            <button
              key={locale}
              type="button"
              role="tab"
              aria-selected={activeLocale === locale}
              onClick={() => setActiveLocale(locale)}
              className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-body-sm font-semibold ${
                activeLocale === locale
                  ? "border-accent bg-accent text-contrast"
                  : "border-border bg-white text-text"
              }`}
            >
              {localeLabels[locale]}
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  localeStatus === "complete"
                    ? "bg-green-500"
                    : localeStatus === "partial"
                      ? "bg-amber-500"
                      : "bg-slate-300"
                }`}
                aria-label={localeStatus === "complete" ? "Compleet" : localeStatus === "partial" ? "Deels ingevuld" : "Leeg"}
              />
            </button>
          );
        })}
      </div>

      <div className="mt-5" role="tabpanel">
        <div className="mb-4 inline-flex rounded-full bg-background px-3 py-1 text-xs font-semibold text-muted">
          Status: {status === "complete" ? "compleet" : status === "partial" ? "deels ingevuld" : "nog leeg"}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className={labelClass}>
            Productnaam ({activeLocale.toUpperCase()})
            <input
              value={current.name}
              onChange={(event) => setField("name", event.target.value)}
              className={inputClass}
              required={activeLocale === "nl"}
            />
          </label>
          <label className={labelClass}>
            Slug ({activeLocale.toUpperCase()})
            <div className="mt-1 flex flex-col gap-2 sm:flex-row">
              <input
                value={current.slug}
                onChange={(event) => setField("slug", event.target.value)}
                className="min-h-11 min-w-0 flex-1 rounded-button border border-border px-3 py-2 text-body-sm"
                required={activeLocale === "nl"}
              />
              <button
                type="button"
                onClick={() => onSlugFromName(activeLocale)}
                className="min-h-11 rounded-button border border-border px-4 font-semibold"
              >
                Maak van naam
              </button>
            </div>
          </label>
          <label className={`${labelClass} md:col-span-2`}>
            Korte omschrijving <span className="font-normal text-muted">({current.shortDescription.length}/220)</span>
            <textarea
              value={current.shortDescription}
              onChange={(event) => setField("shortDescription", event.target.value.slice(0, 220))}
              rows={3}
              className={inputClass}
            />
          </label>
          <div className={`${labelClass} md:col-span-2`}>
            Volledige omschrijving
            <RichTextEditor
              id={`description-${activeLocale}`}
              value={current.descriptionHtml || current.description}
              onChange={(value) => setField("descriptionHtml", value)}
              ariaLabel={`Volledige omschrijving ${localeLabels[activeLocale]}`}
            />
          </div>
          <label className={labelClass}>
            SEO-titel <span className="font-normal text-muted">({current.seoTitle.length}/60)</span>
            <input
              value={current.seoTitle}
              maxLength={60}
              onChange={(event) => setField("seoTitle", event.target.value)}
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Meta-omschrijving <span className="font-normal text-muted">({current.metaDescription.length}/160)</span>
            <textarea
              value={current.metaDescription}
              maxLength={160}
              onChange={(event) => setField("metaDescription", event.target.value)}
              rows={3}
              className={inputClass}
            />
          </label>
          <label className={`${labelClass} md:col-span-2`}>
            Productactie-tekst <span className="font-normal text-muted">optioneel, per taal</span>
            <input
              value={current.promotionText}
              maxLength={160}
              onChange={(event) => setField("promotionText", event.target.value)}
              className={inputClass}
              placeholder="Bijv. Alleen deze week extra voordelig"
            />
          </label>
        </div>
      </div>
    </section>
  );
}
