"use client";

import { useMemo, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import type nl from "@/dictionaries/nl.json";
import type { Locale } from "@/lib/i18n";
import type { ProductSummaryDto } from "@/lib/queries";
import { cn } from "@/lib/cn";
import { ProductCard } from "@/components/product/ProductCard";

type FacetOption = { value: string; label: string };
type Facet = { key: string; label: string; options: FacetOption[] };

export function ProductBrowser({
  products,
  locale,
  dictionary,
}: {
  products: ProductSummaryDto[];
  locale: Locale;
  dictionary: typeof nl;
}) {
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const facets: Facet[] = [
    {
      key: "preparation",
      label: dictionary.filters.preparationLabel,
      options: [
        { value: "ROASTED", label: dictionary.filters.preparationRoasted },
        { value: "RAW", label: dictionary.filters.preparationRaw },
      ],
    },
    {
      key: "salting",
      label: dictionary.filters.saltingLabel,
      options: [
        { value: "SALTED", label: dictionary.filters.saltingSalted },
        { value: "UNSALTED", label: dictionary.filters.saltingUnsalted },
      ],
    },
    {
      key: "coating",
      label: dictionary.filters.coatingLabel,
      options: [
        { value: "NONE", label: dictionary.filters.coatingNone },
        { value: "CHOCOLATE", label: dictionary.filters.coatingChocolate },
        { value: "YOGHURT", label: dictionary.filters.coatingYoghurt },
        { value: "FLAVORED", label: dictionary.filters.coatingFlavored },
      ],
    },
  ];

  function toggleValue(value: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
  }

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return products.filter((product) => {
      if (normalizedQuery && !product.name.toLowerCase().includes(normalizedQuery)) {
        return false;
      }

      for (const facet of facets) {
        const selectedInFacet = facet.options
          .map((option) => option.value)
          .filter((value) => selected.has(value));

        if (selectedInFacet.length === 0) continue;

        const matches = product.variants.some((variant) => {
          const variantValue = variant[facet.key as "preparation" | "salting" | "coating"];
          return selectedInFacet.includes(variantValue);
        });

        if (!matches) return false;
      }

      return true;
    });
  }, [products, query, selected, facets]);

  const activeCount = selected.size;

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">{dictionary.common.search}</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={dictionary.common.search}
            className="h-11 w-full rounded-button border border-border bg-surface pl-10 pr-3 text-body-md text-text placeholder:text-muted focus-visible:outline-2 focus-visible:outline-accent"
          />
        </label>
        <button
          type="button"
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen((value) => !value)}
          className={cn(
            "inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-button border border-border bg-surface px-4 font-heading text-body-md font-semibold text-text transition-colors duration-hover-fast hover:border-border-hover",
            activeCount > 0 && "border-accent text-accent-hover"
          )}
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          {dictionary.category.filters}
          {activeCount > 0 ? (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[0.65rem] font-bold text-contrast">
              {activeCount}
            </span>
          ) : null}
        </button>
      </div>

      {filtersOpen ? (
        <div className="mt-3 flex flex-col gap-4 rounded-panel border border-border bg-surface p-4 sm:flex-row sm:flex-wrap sm:gap-8">
          {facets.map((facet) => (
            <div key={facet.key}>
              <p className="font-heading text-body-sm font-bold text-text">{facet.label}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {facet.options.map((option) => {
                  const active = selected.has(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleValue(option.value)}
                      className={cn(
                        "min-h-9 rounded-button border px-3 text-body-sm transition-colors duration-hover-fast",
                        active
                          ? "border-accent bg-accent text-contrast"
                          : "border-border bg-background text-text hover:border-border-hover"
                      )}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {activeCount > 0 ? (
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="self-start font-heading text-body-sm font-semibold text-muted underline decoration-border-hover underline-offset-4 hover:text-text"
            >
              {dictionary.filters.reset}
            </button>
          ) : null}
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <p className="mt-8 text-center text-body-md text-muted" aria-live="polite">
          {dictionary.category.noResults}
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4">
          {filtered.map((item) => (
            <ProductCard key={item.id} product={item} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}
