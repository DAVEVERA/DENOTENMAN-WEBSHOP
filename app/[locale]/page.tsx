import { notFound } from "next/navigation";
import { locales, isLocale, type Locale } from "@/lib/i18n";
import { getCategory, getFilteredProducts } from "@/lib/queries";
import { getAlternates } from "@/lib/alternates";
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
  const products = await getFilteredProducts("all", locale, [], { limit: 300 });
  const featuredCategory = await getCategory("acties", locale);

  return (
    <SiteShell locale={locale} dictionary={dictionary} languages={alternates?.languages ?? {}}>
      <VideoHero locale={locale} />
      <FeaturedBanner
        products={featuredCategory?.products ?? []}
        locale={locale}
        dictionary={dictionary}
      />
      <Container className="py-8 sm:py-10">
        <ProductBrowser products={products} locale={locale} dictionary={dictionary} />
      </Container>
    </SiteShell>
  );
}
