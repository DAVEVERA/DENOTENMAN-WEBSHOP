import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { locales, isLocale } from "@/lib/i18n";
import {
  getCatalogProducts,
  normalizeCatalogFilterValues,
} from "@/lib/queries";
import { getHeroProductHotspots } from "@/lib/hero-hotspots.server";
import { getAlternates } from "@/lib/alternates";
import { buildStorefrontMetadata } from "@/lib/storefront-seo";
import { Container } from "@/components/ui/Container";
import { ProductBrowser } from "@/components/product/ProductBrowser";
import { SiteShell } from "@/components/layout/SiteShell";
import { VisualHero } from "@/components/layout/VisualHero";
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
  const alternates = await getAlternates(rawLocale, { type: "home" });

  return buildStorefrontMetadata({
    title: dictionary.seo.home.title,
    description: dictionary.seo.home.description,
    alternates,
  });
}

export default async function HomePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string | string[]; f?: string | string[] }>;
}) {
  const [{ locale: rawLocale }, queryParams] = await Promise.all([params, searchParams]);

  if (!isLocale(rawLocale)) {
    notFound();
  }

  const locale = rawLocale;
  const dictionary = dictionaries[locale];
  const initialQuery = (Array.isArray(queryParams.q) ? queryParams.q[0] : queryParams.q ?? "")
    .trim()
    .slice(0, 100);
  const rawFilters = Array.isArray(queryParams.f) ? queryParams.f[0] : queryParams.f ?? "";
  const initialFilters = normalizeCatalogFilterValues(rawFilters.split(","));
  const alternates = await getAlternates(locale, { type: "home" });
  // Keep the initial RSC payload bounded; subsequent catalog pages are fetched on demand.
  const [catalogPage, heroHotspots] = await Promise.all([
    getCatalogProducts(locale, { query: initialQuery, filters: initialFilters }),
    getHeroProductHotspots(locale),
  ]);

  return (
    <SiteShell locale={locale} dictionary={dictionary} languages={alternates?.languages ?? {}}>
      <VisualHero dictionary={dictionary} hotspots={heroHotspots} />
      <Container className="py-8 sm:py-10">
        <ProductBrowser
          initialPage={catalogPage}
          initialQuery={initialQuery}
          initialFilters={initialFilters}
          locale={locale}
          copy={{
            search: dictionary.common.search,
            loading: dictionary.common.loading,
            loadError:
              locale === "nl"
                ? "Producten laden is niet gelukt. Probeer het opnieuw."
                : locale === "fr"
                  ? "Le chargement des produits a \u00e9chou\u00e9. R\u00e9essayez."
                  : "Products could not be loaded. Please try again.",
            retry: locale === "nl" ? "Opnieuw proberen" : locale === "fr" ? "R\u00e9essayer" : "Try again",
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
              stockAlert:
                locale === "nl" ? "Geef me een seintje" : locale === "fr" ? "Pr\u00e9venez-moi" : "Notify me",
              loadingQuickView:
                locale === "nl" ? "Product laden\u2026" : locale === "fr" ? "Chargement du produit\u2026" : "Loading product\u2026",
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
      </Container>
    </SiteShell>
  );
}
