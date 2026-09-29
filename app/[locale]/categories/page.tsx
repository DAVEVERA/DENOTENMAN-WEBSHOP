import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { locales, isLocale } from "@/lib/i18n";
import {
  getCatalogProducts,
  getMainCategories,
  normalizeCatalogFilterValues,
} from "@/lib/queries";
import { normalizeCatalogSort } from "@/lib/catalog-sort";
import { getAlternates } from "@/lib/alternates";
import { category as categoryPath } from "@/lib/routes";
import { buildStorefrontMetadata } from "@/lib/storefront-seo";
import { Container } from "@/components/ui/Container";
import { ProductBrowser } from "@/components/product/ProductBrowser";
import { SiteShell } from "@/components/layout/SiteShell";
import nl from "@/dictionaries/nl.json";
import en from "@/dictionaries/en.json";
import fr from "@/dictionaries/fr.json";

const dictionaries = { nl, en, fr };

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;

  if (!isLocale(rawLocale)) {
    return {};
  }

  const dictionary = dictionaries[rawLocale];
  const alternates = await getAlternates(rawLocale, { type: "categories" });

  return buildStorefrontMetadata({
    title: dictionary.seo.categories.title,
    description: dictionary.seo.categories.description,
    alternates,
  });
}

export default async function CategoriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    q?: string | string[];
    f?: string | string[];
    sort?: string | string[];
  }>;
}) {
  const [{ locale: rawLocale }, queryParams] = await Promise.all([params, searchParams]);

  if (!isLocale(rawLocale)) {
    notFound();
  }

  const locale = rawLocale;
  const dictionary = dictionaries[locale];
  const alternates = await getAlternates(locale, { type: "categories" });
  const initialQuery = (Array.isArray(queryParams.q) ? queryParams.q[0] : queryParams.q ?? "")
    .trim()
    .slice(0, 100);
  const rawFilters = Array.isArray(queryParams.f) ? queryParams.f[0] : queryParams.f ?? "";
  const initialFilters = normalizeCatalogFilterValues(rawFilters.split(","));
  const initialSort = normalizeCatalogSort(
    Array.isArray(queryParams.sort) ? queryParams.sort[0] : queryParams.sort
  );
  const [catalogPage, categories] = await Promise.all([
    getCatalogProducts(locale, {
      query: initialQuery,
      filters: initialFilters,
      sort: initialSort,
    }),
    getMainCategories(locale),
  ]);

  return (
    <SiteShell locale={locale} dictionary={dictionary} languages={alternates?.languages ?? {}}>
      <Container className="py-10">
        <header className="max-w-3xl">
          <h1 className="font-heading text-3xl font-bold tracking-heading text-text sm:text-4xl">
            {dictionary.seo.categories.heading}
          </h1>
          <p className="mt-3 text-body-md leading-relaxed text-muted">
            {dictionary.seo.categories.intro}
          </p>
        </header>

        <section className="mt-8" aria-labelledby="category-links-heading">
          <h2 id="category-links-heading" className="font-heading text-heading-md font-bold text-text">
            {dictionary.seo.categories.categoryLinksHeading}
          </h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((category) => (
              <li key={category.id}>
                <Link
                  href={categoryPath(locale, category.slug)}
                  className="flex min-h-16 items-center justify-between rounded-card border border-border bg-surface px-5 py-4 font-heading text-heading-sm font-bold text-text shadow-card transition-colors hover:border-border-hover hover:text-accent-hover"
                >
                  <span>{category.name}</span>
                  <span aria-hidden="true">&rarr;</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-10" aria-labelledby="all-products-heading">
          <h2 id="all-products-heading" className="font-heading text-heading-md font-bold text-text">
            {dictionary.seo.categories.productsHeading}
          </h2>
          <div className="mt-6">
            <ProductBrowser
              initialPage={catalogPage}
              initialQuery={initialQuery}
              initialFilters={initialFilters}
              initialSort={initialSort}
              locale={locale}
              copy={{
                search: dictionary.common.search,
                loading: dictionary.common.loading,
                loadError: dictionary.catalog.loadError,
                retry: dictionary.catalog.retry,
                filters: dictionary.category.filters,
                noResults: dictionary.category.noResults,
                categoryLabel: dictionary.filters.categoryLabel,
                preparationLabel: dictionary.filters.preparationLabel,
                preparationRoasted: dictionary.filters.preparationRoasted,
                preparationRaw: dictionary.filters.preparationRaw,
                saltingLabel: dictionary.filters.saltingLabel,
                saltingSalted: dictionary.filters.saltingSalted,
                saltingUnsalted: dictionary.filters.saltingUnsalted,
                coatingLabel: dictionary.filters.coatingLabel,
                coatingNone: dictionary.filters.coatingNone,
                coatingChocolate: dictionary.filters.coatingChocolate,
                coatingYoghurt: dictionary.filters.coatingYoghurt,
                coatingFlavored: dictionary.filters.coatingFlavored,
                sortLabel: dictionary.filters.sortLabel,
                sortPriceLowHigh: dictionary.filters.sortPriceLowHigh,
                sortPriceHighLow: dictionary.filters.sortPriceHighLow,
                sortPopular: dictionary.filters.sortPopular,
                sortBestSelling: dictionary.filters.sortBestSelling,
                sortMostViewed: dictionary.filters.sortMostViewed,
                reset: dictionary.filters.reset,
                clearAll: dictionary.filters.clearAll,
                closeFilters: dictionary.filters.closeFilters,
                removeFilter: dictionary.filters.removeFilter,
                resultsCountSingular: dictionary.filters.resultsCountSingular,
                resultsCountPlural: dictionary.filters.resultsCountPlural,
                loadMore: dictionary.filters.loadMore,
                card: {
                  outOfStock: dictionary.product.outOfStock,
                  addToFavorites: dictionary.product.addToFavorites,
                  removeFromFavorites: dictionary.product.removeFromFavorites,
                  openQuickView: dictionary.product.openQuickView,
                  quickOrder: dictionary.product.quickOrder,
                  moreInfo: dictionary.product.moreInfo,
                  stockAlert: dictionary.product.stockAlert,
                  loadingQuickView: dictionary.product.loadingQuickView,
                },
                quickView: {
                  selectQuantity: dictionary.product.selectQuantity,
                  closeQuickView: dictionary.product.closeQuickView,
                  outOfStock: dictionary.product.outOfStock,
                  inStock: dictionary.product.inStock,
                  quantity: dictionary.product.quantity,
                  added: dictionary.product.addedToCart,
                  goToCart: dictionary.product.goToCart,
                  continueShopping: dictionary.product.continueShopping,
                  order: dictionary.product.order,
                  quickOrder: dictionary.product.quickOrder,
                  moreInfo: dictionary.product.moreInfo,
                  decrease: dictionary.cart.decrease,
                  increase: dictionary.cart.increase,
                },
              }}
            />
          </div>
        </section>
      </Container>
    </SiteShell>
  );
}
