"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import type {
  CatalogFacetOptionDto,
  CatalogPageDto,
  CatalogProductDto,
  ProductSummaryDto,
} from "@/lib/queries";
import { product as productPath } from "@/lib/routes";
import { cn } from "@/lib/cn";
import {
  CATALOG_SEARCH_EVENT,
  type CatalogSearchEventDetail,
} from "@/lib/catalogSearch";
import {
  ProductCard,
  type ProductCardCopy,
  type ProductCardProduct,
} from "@/components/product/ProductCard";
import {
  ProductQuickView,
  type ProductQuickViewCopy,
} from "@/components/product/ProductQuickView";

type FacetOption = { value: string; label: string };
type Facet = { key: string; label: string; options: FacetOption[] };

export type CatalogBrowserCopy = {
  search: string;
  loading: string;
  loadError: string;
  retry: string;
  filters: string;
  noResults: string;
  categoryLabel: string;
  preparationLabel: string;
  preparationRoasted: string;
  preparationRaw: string;
  saltingLabel: string;
  saltingSalted: string;
  saltingUnsalted: string;
  coatingLabel: string;
  coatingNone: string;
  coatingChocolate: string;
  coatingYoghurt: string;
  coatingFlavored: string;
  reset: string;
  clearAll: string;
  closeFilters: string;
  removeFilter: string;
  resultsCountSingular: string;
  resultsCountPlural: string;
  loadMore: string;
  card: ProductCardCopy;
  quickView: ProductQuickViewCopy;
};

const QUERY_PARAM = "q";
const FILTERS_PARAM = "f";
const URL_SYNC_DELAY_MS = 300;
const CATALOG_FETCH_DELAY_MS = 250;

function requestKey(query: string, filters: Set<string>): string {
  return `${query.trim()}::${Array.from(filters).sort().join(",")}`;
}

function filterValuesFromUrl(params: URLSearchParams): Set<string> {
  return new Set(
    (params.get(FILTERS_PARAM) ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0 && value.length <= 100)
      .slice(0, 50)
  );
}

function catalogApiUrl(
  locale: Locale,
  query: string,
  filters: Set<string>,
  offset: number
): string {
  const params = new URLSearchParams({ locale, offset: String(offset) });
  const trimmedQuery = query.trim();
  if (trimmedQuery) params.set(QUERY_PARAM, trimmedQuery);
  if (filters.size > 0) params.set(FILTERS_PARAM, Array.from(filters).sort().join(","));
  return `/api/storefront/catalog?${params.toString()}`;
}

export function ProductBrowser({
  initialPage,
  initialQuery,
  initialFilters,
  locale,
  copy,
}: {
  initialPage: CatalogPageDto;
  initialQuery: string;
  initialFilters: string[];
  locale: Locale;
  copy: CatalogBrowserCopy;
}) {
  const pathname = usePathname();
  const initialSelected = useMemo(() => new Set(initialFilters), [initialFilters]);
  const [products, setProducts] = useState<CatalogProductDto[]>(initialPage.products);
  const [total, setTotal] = useState(initialPage.total);
  const [categoryOptions, setCategoryOptions] = useState<CatalogFacetOptionDto[]>(
    initialPage.categoryOptions
  );
  const [query, setQuery] = useState(initialQuery);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(initialSelected);
  const [hydrated, setHydrated] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [catalogError, setCatalogError] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [quickViewProduct, setQuickViewProduct] = useState<ProductSummaryDto | null>(null);
  const [quickViewOpen, setQuickViewOpen] = useState(false);
  const [loadingProductId, setLoadingProductId] = useState<string | null>(null);
  const lastLoadedSignature = useRef(`${requestKey(initialQuery, initialSelected)}::0`);
  const catalogRequestId = useRef(0);
  const quickViewRequestId = useRef(0);
  const quickViewCache = useRef(new Map<string, ProductSummaryDto>());

  useEffect(() => {
    const restoreFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      setQuery(params.get(QUERY_PARAM) ?? "");
      setSelected(filterValuesFromUrl(params));
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

  useEffect(() => {
    if (!hydrated) return;
    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const trimmedQuery = query.trim();
      params.delete(QUERY_PARAM);
      params.delete(FILTERS_PARAM);
      if (trimmedQuery) params.set(QUERY_PARAM, trimmedQuery);
      if (selected.size > 0) {
        params.set(FILTERS_PARAM, Array.from(selected).sort().join(","));
      }
      const queryString = params.toString();
      window.history.replaceState(null, "", queryString ? `${pathname}?${queryString}` : pathname);
    }, URL_SYNC_DELAY_MS);
    return () => window.clearTimeout(timeout);
  }, [query, selected, hydrated, pathname]);

  useEffect(() => {
    if (!hydrated) return;
    const key = requestKey(query, selected);
    const signature = `${key}::${reloadNonce}`;
    if (signature === lastLoadedSignature.current) return;

    const requestId = ++catalogRequestId.current;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setCatalogLoading(true);
      setLoadingMore(false);
      setCatalogError(false);
      try {
        const response = await fetch(catalogApiUrl(locale, query, selected, 0), {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        if (!response.ok) throw new Error(`Catalog request failed (${response.status})`);
        const page = (await response.json()) as CatalogPageDto;
        if (requestId !== catalogRequestId.current) return;
        setProducts(page.products);
        setTotal(page.total);
        setCategoryOptions(page.categoryOptions);
        lastLoadedSignature.current = signature;
      } catch (error) {
        if (controller.signal.aborted || requestId !== catalogRequestId.current) return;
        console.error("Storefront catalog request failed", error);
        setCatalogError(true);
      } finally {
        if (requestId === catalogRequestId.current) setCatalogLoading(false);
      }
    }, CATALOG_FETCH_DELAY_MS);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [hydrated, locale, query, reloadNonce, selected]);

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

  const facets: Facet[] = useMemo(
    () => [
      { key: "category", label: copy.categoryLabel, options: categoryOptions },
      {
        key: "preparation",
        label: copy.preparationLabel,
        options: [
          { value: "ROASTED", label: copy.preparationRoasted },
          { value: "RAW", label: copy.preparationRaw },
        ],
      },
      {
        key: "salting",
        label: copy.saltingLabel,
        options: [
          { value: "SALTED", label: copy.saltingSalted },
          { value: "UNSALTED", label: copy.saltingUnsalted },
        ],
      },
      {
        key: "coating",
        label: copy.coatingLabel,
        options: [
          { value: "NONE", label: copy.coatingNone },
          { value: "CHOCOLATE", label: copy.coatingChocolate },
          { value: "YOGHURT", label: copy.coatingYoghurt },
          { value: "FLAVORED", label: copy.coatingFlavored },
        ],
      },
    ],
    [categoryOptions, copy]
  );

  function toggleValue(value: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; onRemove: () => void }[] = [];
    const trimmedQuery = query.trim();
    if (trimmedQuery) {
      chips.push({ key: "search", label: trimmedQuery, onRemove: () => setQuery("") });
    }
    for (const facet of facets) {
      for (const option of facet.options) {
        if (selected.has(option.value)) {
          chips.push({
            key: `${facet.key}:${option.value}`,
            label: option.label,
            onRemove: () => toggleValue(option.value),
          });
        }
      }
    }
    return chips;
  }, [facets, query, selected]);

  async function loadMore() {
    if (loadingMore || products.length >= total) return;
    const requestId = catalogRequestId.current;
    setLoadingMore(true);
    setCatalogError(false);
    try {
      const response = await fetch(catalogApiUrl(locale, query, selected, products.length), {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error(`Catalog request failed (${response.status})`);
      const page = (await response.json()) as CatalogPageDto;
      if (requestId !== catalogRequestId.current) return;
      setProducts((current) => {
        const seen = new Set(current.map((product) => product.id));
        return [...current, ...page.products.filter((product) => !seen.has(product.id))];
      });
      setTotal(page.total);
    } catch (error) {
      console.error("Loading more storefront products failed", error);
      setCatalogError(true);
    } finally {
      if (requestId === catalogRequestId.current) setLoadingMore(false);
    }
  }

  async function openQuickView(product: ProductCardProduct) {
    if (loadingProductId === product.id) return;
    const cached = quickViewCache.current.get(product.id);
    if (cached) {
      setQuickViewProduct(cached);
      setQuickViewOpen(true);
      return;
    }

    const requestId = ++quickViewRequestId.current;
    setLoadingProductId(product.id);
    try {
      const response = await fetch(
        `/api/storefront/products/${encodeURIComponent(product.id)}?locale=${locale}`,
        { headers: { Accept: "application/json" } }
      );
      if (!response.ok) throw new Error(`Quick-view request failed (${response.status})`);
      const rawDetail = (await response.json()) as Omit<ProductSummaryDto, "updatedAt"> & {
        updatedAt: string;
      };
      const detail: ProductSummaryDto = {
        ...rawDetail,
        updatedAt: new Date(rawDetail.updatedAt),
      };
      if (requestId !== quickViewRequestId.current) return;
      quickViewCache.current.set(product.id, detail);
      setQuickViewProduct(detail);
      setQuickViewOpen(true);
    } catch (error) {
      console.error("Storefront quick view request failed", error);
      window.location.assign(productPath(locale, product.slug));
    } finally {
      if (requestId === quickViewRequestId.current) setLoadingProductId(null);
    }
  }

  function clearAll() {
    setQuery("");
    setSelected(new Set());
  }

  const activeCount = selected.size;
  const resultsLabel =
    total === 1
      ? copy.resultsCountSingular
      : copy.resultsCountPlural.replace("{count}", String(total));
  const remaining = Math.max(total - products.length, 0);

  return (
    <div id="product-search" className="min-w-0 scroll-mt-36">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">{copy.search}</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={copy.search}
            className="h-11 w-full min-w-0 rounded-button border border-border bg-surface pl-10 pr-3 text-body-md text-text placeholder:text-muted focus-visible:outline-2 focus-visible:outline-accent"
          />
        </label>

        <div className="relative min-w-0 shrink-0">
          <button
            type="button"
            aria-expanded={filtersOpen}
            aria-controls="product-filters-panel"
            onClick={() => setFiltersOpen((value) => !value)}
            className={cn(
              "inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-button border border-border bg-surface px-4 font-heading text-body-md font-semibold text-text transition-colors duration-hover-fast hover:border-border-hover sm:w-auto",
              activeCount > 0 && "border-accent text-accent-ink"
            )}
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            {copy.filters}
            {activeCount > 0 ? (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[0.65rem] font-bold text-contrast">
                {activeCount}
              </span>
            ) : null}
          </button>

          {filtersOpen ? (
            <>
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
                aria-label={copy.filters}
                className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] min-w-0 flex-col overflow-hidden rounded-t-panel border border-border bg-surface shadow-card-hover sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-[calc(100%+0.5rem)] sm:max-h-[70vh] sm:w-[min(92vw,26rem)] sm:rounded-panel"
              >
                <div className="flex shrink-0 items-center justify-between border-b border-border bg-background px-4 py-3">
                  <p className="font-heading text-body-md font-bold text-text">{copy.filters}</p>
                  <button
                    type="button"
                    onClick={() => setFiltersOpen(false)}
                    aria-label={copy.closeFilters}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full text-text hover:bg-surface"
                  >
                    <X className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
                <div className="flex min-w-0 flex-col gap-5 overflow-y-auto overflow-x-hidden px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                  {facets.map((facet) => (
                    <div key={facet.key} className="min-w-0">
                      <p className="font-heading text-body-sm font-bold text-text">{facet.label}</p>
                      <div className="mt-2 flex min-w-0 flex-wrap gap-2">
                        {facet.options.map((option) => {
                          const active = selected.has(option.value);
                          return (
                            <button
                              key={option.value}
                              type="button"
                              aria-pressed={active}
                              onClick={() => toggleValue(option.value)}
                              className={cn(
                                "min-h-11 max-w-full rounded-button border px-3 text-body-sm [overflow-wrap:anywhere] transition-colors duration-hover-fast",
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
                      className="min-h-11 self-start rounded-button px-2 font-heading text-body-sm font-semibold text-muted underline decoration-border-hover underline-offset-4 hover:text-text"
                    >
                      {copy.reset}
                    </button>
                  ) : null}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {activeChips.length > 0 ? (
        <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.onRemove}
              aria-label={copy.removeFilter.replace("{label}", chip.label)}
              className="inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-full border border-border bg-surface pl-3 pr-2 text-body-sm text-text transition-colors duration-hover-fast hover:border-border-hover"
            >
              <span className="truncate">{chip.label}</span>
              <X className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
            </button>
          ))}
          {activeChips.length > 1 ? (
            <button
              type="button"
              onClick={clearAll}
              className="min-h-11 rounded-button px-2 font-heading text-body-sm font-semibold text-muted underline decoration-border-hover underline-offset-4 hover:text-text"
            >
              {copy.clearAll}
            </button>
          ) : null}
        </div>
      ) : null}

      <p className="mt-3 text-body-sm text-muted" aria-live="polite" aria-busy={catalogLoading}>
        {catalogLoading ? copy.loading : resultsLabel}
      </p>

      {catalogError ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3 rounded-card border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
          <span>{copy.loadError}</span>
          <button
            type="button"
            onClick={() => setReloadNonce((value) => value + 1)}
            className="min-h-11 rounded-button border border-red-300 bg-white px-4 font-semibold"
          >
            {copy.retry}
          </button>
        </div>
      ) : null}

      {!catalogLoading && products.length === 0 ? (
        <p className="mt-8 text-center text-body-md text-muted" aria-live="polite">
          {copy.noResults}
        </p>
      ) : (
        <div className="mt-6 grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4">
          {products.map((item) => (
            <ProductCard
              key={item.id}
              product={item}
              categoryName={item.category?.name}
              locale={locale}
              copy={copy.card}
              quickViewCopy={copy.quickView}
              quickViewLoading={loadingProductId === item.id}
              onQuickView={openQuickView}
            />
          ))}
        </div>
      )}

      {remaining > 0 ? (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            disabled={loadingMore || catalogLoading}
            onClick={loadMore}
            className="min-h-11 rounded-button border border-border bg-surface px-5 font-heading text-body-sm font-semibold text-text shadow-card transition-colors hover:border-border-hover disabled:cursor-wait disabled:opacity-60"
          >
            {loadingMore ? copy.loading : copy.loadMore.replace("{remaining}", String(remaining))}
          </button>
        </div>
      ) : null}

      {quickViewProduct ? (
        <ProductQuickView
          open={quickViewOpen}
          onClose={() => setQuickViewOpen(false)}
          product={quickViewProduct}
          locale={locale}
          copy={copy.quickView}
        />
      ) : null}
    </div>
  );
}
