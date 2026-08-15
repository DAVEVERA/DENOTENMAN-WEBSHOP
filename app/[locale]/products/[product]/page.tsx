import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { locales, isLocale, type Locale } from "@/lib/i18n";
import { getProductBySlug, getProductSlugs } from "@/lib/queries";
import { getAlternates } from "@/lib/alternates";
import { ProductDetailContent } from "@/components/product/ProductDetailContent";
import { ProductDetailModal } from "@/components/product/ProductDetailModal";
import nl from "@/dictionaries/nl.json";
import en from "@/dictionaries/en.json";
import fr from "@/dictionaries/fr.json";
import { product as productPath } from "@/lib/routes";

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
    title: data.seoTitle ?? data.name,
    description: data.metaDescription ?? data.shortDescription ?? data.description ?? undefined,
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
  if (data.slug !== product) {
    permanentRedirect(productPath(locale, data.slug));
  }

  const dictionary = dictionaries[locale];
  const primaryImage = data.images.find((image) => image.isPrimary) ?? data.images[0];
  const firstVariant = [...data.variants].sort((left, right) => left.priceCents - right.priceCents)[0];
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: data.name,
    description: data.shortDescription ?? data.description ?? undefined,
    sku: data.sku,
    image: primaryImage ? [primaryImage.url] : undefined,
    brand: { "@type": "Brand", name: "De Notenman" },
    offers: {
      "@type": "Offer",
      url: `https://denotenman.com${productPath(locale, data.slug)}`,
      priceCurrency: data.currency,
      price: ((firstVariant?.priceCents ?? data.basePriceCents) / 100).toFixed(2),
      availability: data.isActive && firstVariant ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
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
