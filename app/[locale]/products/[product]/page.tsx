import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { isLocale, type Locale } from "@/lib/i18n";
import { getProductBySlug } from "@/lib/queries";
import { getAlternates } from "@/lib/alternates";
import { ProductDetailContent } from "@/components/product/ProductDetailContent";
import { ProductDetailModal } from "@/components/product/ProductDetailModal";
import nl from "@/dictionaries/nl.json";
import en from "@/dictionaries/en.json";
import fr from "@/dictionaries/fr.json";
import { BASE_URL, product as productPath } from "@/lib/routes";
import { buildProductStructuredData } from "@/lib/structured-data";
import { buildMetadata } from "@/lib/seo/metadata";
import { resolveProductDescription } from "@/lib/product-description";
import { JsonLd } from "@/components/seo/JsonLd";

const dictionaries = { nl, en, fr };

export const dynamic = "force-dynamic";

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

  // No `image` here on purpose: opengraph-image.tsx in this segment renders
  // the product's own photo and supplies the og:image tags.
  return buildMetadata({
    title: data.seoTitle ?? data.name,
    description: data.metaDescription ?? resolveProductDescription(data, rawLocale),
    locale: rawLocale,
    alternates,
  });
}

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; product: string }>;
  searchParams: Promise<{ variant?: string | string[] }>;
}) {
  const [{ locale: rawLocale, product }, query] = await Promise.all([params, searchParams]);

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
  const initialVariantSku = typeof query.variant === "string" ? query.variant : undefined;
  const structuredData = buildProductStructuredData({ product: data, locale, baseUrl: BASE_URL });

  return (
    <>
      <JsonLd data={structuredData} />
      <div className="min-h-[72vh] bg-background" aria-hidden="true" />
      <ProductDetailModal
        locale={locale}
        productName={data.name}
        backLabel={dictionary.product.backToProducts}
        closeLabel={dictionary.product.closeDetails}
      >
        <ProductDetailContent
          data={data}
          locale={locale}
          initialVariantSku={initialVariantSku}
        />
      </ProductDetailModal>
    </>
  );
}
