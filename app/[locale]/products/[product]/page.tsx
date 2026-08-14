import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { locales, isLocale, type Locale } from "@/lib/i18n";
import { getProductBySlug, getProductSlugs } from "@/lib/queries";
import { getAlternates } from "@/lib/alternates";
import { ProductDetailContent } from "@/components/product/ProductDetailContent";
import { ProductDetailModal } from "@/components/product/ProductDetailModal";
import nl from "@/dictionaries/nl.json";
import en from "@/dictionaries/en.json";
import fr from "@/dictionaries/fr.json";

const dictionaries = { nl, en, fr };

export async function generateStaticParams() {
  const params = await Promise.all(
    locales.map(async (locale) => {
      const entries = await getProductSlugs(locale);
      return entries.map((entry) => ({ locale, product: entry.slug }));
    })
  );

  return params.flat();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; product: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale, product } = await params;

  if (!isLocale(rawLocale)) {
    return {};
  }

  const [alternates, data] = await Promise.all([
    getAlternates(rawLocale, { type: "product", slug: product }),
    getProductBySlug(product, rawLocale),
  ]);

  if (!alternates || !data) {
    return {};
  }

  return {
    title: data.name,
    description: data.shortDescription ?? data.description ?? undefined,
    alternates: {
      canonical: alternates.canonical,
      languages: alternates.languages,
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: string; product: string }>;
}) {
  const { locale: rawLocale, product } = await params;

  if (!isLocale(rawLocale)) {
    notFound();
  }

  const locale: Locale = rawLocale;
  const data = await getProductBySlug(product, locale);

  if (!data) {
    notFound();
  }

  const dictionary = dictionaries[locale];

  return (
    <>
      <div className="min-h-[72vh] bg-background" aria-hidden="true" />
      <ProductDetailModal
        locale={locale}
        productName={data.name}
        backLabel={dictionary.product.backToProducts}
        closeLabel={dictionary.product.closeDetails}
      >
        <ProductDetailContent data={data} locale={locale} />
      </ProductDetailModal>
    </>
  );
}
