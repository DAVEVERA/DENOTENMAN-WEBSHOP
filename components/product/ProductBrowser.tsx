"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import type nl from "@/dictionaries/nl.json";
import type { Locale } from "@/lib/i18n";
import type { ProductSummaryDto } from "@/lib/queries";
import { cn } from "@/lib/cn";
import {
  CATALOG_SEARCH_EVENT,
  type CatalogSearchEventDetail,
} from "@/lib/catalogSearch";
import { ProductCard } from "@/components/product/ProductCard";

type FacetOption = { value: string; label: string };
type Facet = {
  key: string;
  label: string;
  options: FacetOption[];
  getValues: (product: ProductSummaryDto) => string[];
};

const QUERY_PARAM = "q";
const FILTERS_PARAM = "f";
const URL_SYNC_DELAY_MS = 300;
const INITIAL_VISIBLE_PRODUCTS = 24;

export function ProductBrowser({
  products,
  locale,
  dictionary,
}: {
  products: ProductSummaryDto[];
  locale: Locale;
  dictionary: typeof nl;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_PRODUCTS);

  // The static/prerendered HTML always starts unfiltered (query strings
  // aren't known at build time). Once mounted in the browser, restore any
  // filters/search from the URL so reloading, sharing a link, or navigating
  // back preserves what the shopper had set up.
  useEffect(() => {
    const restoreFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      setQuery(params.get(QUERY_PARAM) ?? "");
      setSelected(new Set((params.get(FILTERS_PARAM) ?? "").split(",").filter(Boolean)));
      setHydrated(true);
    };
    const applyNavbarSearch = (event: Event) => {
      const searchEvent = event as CustomEvent<CatalogSearchEventDetail>;
      setQuery(searchEvent.detail.query);
    };

    restoreFromUrl();
    window.addEventListener("popstate", restoreFromUrl);
    window.addEventListener(CATALOG_SEARCH_EVENT, applyNavbarSearch);

    return () => {
      window.removeEventListener("popstate", restoreFromUrl);
      window.removeEventListener(CATALOG_SEARCH_EVENT, applyNavbarSearch);
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.dispatchEvent(new CustomEvent(CATALOG_SEARCH_EVENT, { detail: { query } }));
  }, [query, hydrated]);

  // Keep the URL in sync with the current search/filter state so it stays
  // shareable and survives reloads. Debounced so fast typing doesn't spam
  // history.replaceState.
  useEffect(() => {
    if (!hydrated) return;

    const timeout = setTimeout(() => {
      const params = new URLSearchParams();
      const trimmedQuery = query.trim();
      if (trimmedQuery) params.set(QUERY_PARAM, trimmedQuery);
      if (selected.size > 0) params.set(FILTERS_PARAM, Array.from(selected).join(","));
      const queryString = params.toString();
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
    }, URL_SYNC_DELAY_MS);

    return () => clearTimeout(timeout);
  }, [query, selected, hydrated, pathname, router]);

  // Escape-to-close and a background scroll lock while the panel is open,
  // matching the interaction convention already used by ProductQuickView.
  useEffect(() => {
    if (!filtersOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setFiltersOpen(false);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [filtersOpen]);

  // Every category actually present in this product set — guarantees each
  // option returns at least one result and needs no extra query.
  const categoryOptions = useMemo(() => {
    const bySlug = new Map<string, string>();
    for (const product of products) {
      if (product.category && !bySlug.has(product.category.slug)) {
        bySlug.set(product.category.slug, product.category.name);
      }
    }
    return Array.from(bySlug.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, locale));
  }, [products, locale]);

  const facets: Facet[] = useMemo(
    () => [
      {
        key: "category",
        label: dictionary.filters.categoryLabel,
        options: categoryOptions,
        getValues: (product) => (product.category ? [product.category.slug] : []),
      },
      {
        key: "preparation",
        label: dictionary.filters.preparationLabel,
        options: [
          { value: "ROASTED", label: dictionary.filters.preparationRoasted },
          { value: "RAW", label: dictionary.filters.preparationRaw },
        ],
        getValues: (product) => product.variants.map((variant) => variant.preparation),
      },
      {
        key: "salting",
        label: dictionary.filters.saltingLabel,
        options: [
          { value: "SALTED", label: dictionary.filters.saltingSalted },
          { value: "UNSALTED", label: dictionary.filters.saltingUnsalted },
        ],
        getValues: (product) => product.variants.map((variant) => variant.salting),
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
        getValues: (product) => product.variants.map((variant) => variant.coating),
      },
    ],
    [dictionary, categoryOptions]
  );

  const visibleFacets = useMemo(() => facets.filter((facet) => facet.options.length > 0), [facets]);

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

    return products
      .filter((product) => {
        if (normalizedQuery && !product.name.toLowerCase().includes(normalizedQuery)) {
          return false;
        }

        for (const facet of facets) {
          const selectedInFacet = facet.options
            .map((option) => option.value)
            .filter((value) => selected.has(value));

          if (selectedInFacet.length === 0) continue;

          const values = facet.getValues(product);
          const matches = values.some((value) => selectedInFacet.includes(value));

          if (!matches) return false;
        }

        return true;
      })
      .sort((a, b) => Number(b.isActive) - Number(a.isActive));
  }, [products, query, selected, facets]);
  const visibleProducts = filtered.slice(0, visibleCount);

  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE_PRODUCTS);
  }, [query, selected]);

  const activeCount = selected.size;

  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; onRemove: () => void }[] = [];

    const trimmedQuery = query.trim();
    if (trimmedQuery) {
      chips.push({
        key: "search",
        label: trimmedQuery,
        onRemove: () => setQuery(""),
      });
    }

    for (const facet of facets) {
      for (const option of facet.options) {
        if (selected.has(option.value)) {
          chips.push({
            key: option.value,
            label: option.label,
            onRemove: () => toggleValue(option.value),
          });
        }
      }
    }

    return chips;
  }, [facets, selected, query]);

  function clearAll() {
    setQuery("");
    setSelected(new Set());
  }

  const resultsLabel =
    filtered.length === 1
      ? dictionary.filters.resultsCountSingular
      : dictionary.filters.resultsCountPlural.replace("{count}", String(filtered.length));

  return (
    <div id="product-search" className="scroll-mt-36">
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

        <div className="relative shrink-0">
          <button
            type="button"
            aria-expanded={filtersOpen}
            aria-controls="product-filters-panel"
            onClick={() => setFiltersOpen((value) => !value)}
            className={cn(
              "inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-button border border-border bg-surface px-4 font-heading text-body-md font-semibold text-text transition-colors duration-hover-fast hover:border-border-hover sm:w-auto",
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

          {filtersOpen ? (
            <>
              {/* Click-outside / dismiss layer: an opaque scrim on mobile
                  (bottom-sheet convention), an invisible click-catcher on
                  desktop (dropdown convention). */}
              <button
                type="button"
                aria-hidden="true"
                tabIndex={-1}
                onClick={() => setFiltersOpen(false)}
                className="fixed inset-0 z-40 cursor-default bg-contrast/55 backdrop-blur-[2px] sm:bg-transparent sm:backdrop-blur-none"
              />

              <div
                id="product-filters-panel"
                role="region"
                aria-label={dictionary.category.filters}
                className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col overflow-hidden rounded-t-panel border border-border bg-surface shadow-card-hover sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-[calc(100%+0.5rem)] sm:max-h-[70vh] sm:w-[min(92vw,26rem)] sm:rounded-panel"
              >
                <div className="flex shrink-0 items-center justify-between border-b border-border bg-background px-4 py-3">
                  <p className="font-heading text-body-md font-bold text-text">
                    {dictionary.category.filters}
                  </p>
                  <button
                    type="button"
                    onClick={() => setFiltersOpen(false)}
                    aria-label={dictionary.filters.closeFilters}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full text-text hover:bg-surface"
                  >
                    <X className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>

                <div className="flex flex-col gap-5 overflow-y-auto px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                  {visibleFacets.map((facet) => (
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
              </div>
            </>
          ) : null}
        </div>
      </div>

      {activeChips.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.onRemove}
              aria-label={dictionary.filters.removeFilter.replace("{label}", chip.label)}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-surface pl-3 pr-2 text-body-sm text-text transition-colors duration-hover-fast hover:border-border-hover"
            >
              {chip.label}
              <X className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
            </button>
          ))}
          {activeChips.length > 1 ? (
            <button
              type="button"
              onClick={clearAll}
              className="font-heading text-body-sm font-semibold text-muted underline decoration-border-hover underline-offset-4 hover:text-text"
            >
              {dictionary.filters.clearAll}
            </button>
          ) : null}
        </div>
      ) : null}

      {filtered.length > 0 ? (
        <p className="mt-3 text-body-sm text-muted" aria-live="polite">
          {resultsLabel}
        </p>
      ) : null}

      {filtered.length === 0 ? (
        <p className="mt-8 text-center text-body-md text-muted" aria-live="polite">
          {dictionary.category.noResults}
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4">
          {visibleProducts.map((item) => (
            <ProductCard
              key={item.id}
              product={item}
              categoryName={item.category?.name}
              locale={locale}
            />
          ))}
        </div>
      )}
      {visibleCount < filtered.length ? (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => setVisibleCount((current) => current + INITIAL_VISIBLE_PRODUCTS)}
            className="min-h-11 rounded-button border border-border bg-surface px-5 font-heading text-body-sm font-semibold text-text shadow-card transition-colors hover:border-border-hover"
          >
            {dictionary.filters.loadMore.replace("{remaining}", String(filtered.length - visibleCount))}
          </button>
        </div>
      ) : null}
    </div>
  );
}
