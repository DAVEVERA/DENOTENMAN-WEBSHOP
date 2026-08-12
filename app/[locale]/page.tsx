import { notFound } from "next/navigation";
import { locales, isLocale, type Locale } from "@/lib/i18n";
import { getCategory, getFilteredProducts } from "@/lib/queries";
import { getAlternates } from "@/lib/alternates";
import { categories as categoriesPath } from "@/lib/routes";
import { Container } from "@/components/ui/Container";
import { ProductBrowser } from "@/components/product/ProductBrowser";
import { FeaturedBanner } from "@/components/product/FeaturedBanner";
import { SiteShell } from "@/components/layout/SiteShell";
import { Hero, type HeroSlide } from "@/components/layout/Hero";
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
  const products = await getFilteredProducts("all", locale, []);
  const heroCategory = await getCategory("noten", locale);
  const featuredCategory = await getCategory("acties", locale);

  const heroProduct =
    heroCategory?.products.find((item) => item.images.length > 0) ??
    products.find((item) => item.images.length > 0);
  const heroImage = heroProduct?.images.find((image) => image.isPrimary) ?? heroProduct?.images[0];

  const heroSlides: HeroSlide[] = heroProduct
    ? [
        {
          id: heroProduct.id,
          image: heroImage?.url ?? null,
          imageAlt: heroImage?.alt ?? heroProduct.name,
          heading: dictionary.hero.headline,
          ctaLabel: dictionary.hero.cta,
          ctaHref: categoriesPath(locale),
        },
      ]
    : [];

  return (
    <SiteShell locale={locale} dictionary={dictionary} languages={alternates?.languages ?? {}}>
      {heroSlides.length > 0 ? <Hero slides={heroSlides} dictionary={dictionary} /> : null}
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
