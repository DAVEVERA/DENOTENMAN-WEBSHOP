import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { locales, isLocale } from "@/lib/i18n";
import { getCategory, getFilteredProducts, getMainCategories } from "@/lib/queries";
import { getAlternates } from "@/lib/alternates";
import {
  buildStorefrontMetadata,
  resolvePromotionalCategorySlug,
} from "@/lib/storefront-seo";
import { Container } from "@/components/ui/Container";
import { ProductBrowser } from "@/components/product/ProductBrowser";
import { FeaturedBanner } from "@/components/product/FeaturedBanner";
import { SiteShell } from "@/components/layout/SiteShell";
import { VideoHero } from "@/components/layout/VideoHero";
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
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;

  if (!isLocale(rawLocale)) {
    notFound();
  }

  const locale = rawLocale;
  const dictionary = dictionaries[locale];
  const alternates = await getAlternates(locale, { type: "home" });
  // Explicit high limit: this grid is meant to show the full active catalog
  // (client-side search/filters below narrow it down), not a paginated
  // slice — the default page size would otherwise silently drop most of it.
  const [products, categories] = await Promise.all([
    getFilteredProducts("all", locale, [], { limit: 300 }),
    getMainCategories(locale),
  ]);
  const promotionalSlug = resolvePromotionalCategorySlug(categories);
  const featuredCategory = promotionalSlug ? await getCategory(promotionalSlug, locale) : null;

  return (
    <SiteShell locale={locale} dictionary={dictionary} languages={alternates?.languages ?? {}}>
      <VideoHero locale={locale} dictionary={dictionary} />
      {promotionalSlug ? (
        <FeaturedBanner
          products={featuredCategory?.products ?? []}
          categorySlug={promotionalSlug}
          locale={locale}
          dictionary={dictionary}
        />
      ) : null}
      <Container className="py-8 sm:py-10">
        <ProductBrowser products={products} locale={locale} dictionary={dictionary} />
      </Container>
    </SiteShell>
  );
}
