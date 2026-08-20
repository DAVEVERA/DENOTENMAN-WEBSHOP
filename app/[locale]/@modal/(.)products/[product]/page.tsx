import { notFound, permanentRedirect } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n";
import { getProductBySlug } from "@/lib/queries";
import { ProductDetailContent } from "@/components/product/ProductDetailContent";
import { ProductDetailModal } from "@/components/product/ProductDetailModal";
import { product as productPath } from "@/lib/routes";
import nl from "@/dictionaries/nl.json";
import en from "@/dictionaries/en.json";
import fr from "@/dictionaries/fr.json";

const dictionaries = { nl, en, fr };

export const dynamic = "force-dynamic";

export default async function InterceptedProductPage({
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

  return (
    <ProductDetailModal
      locale={locale}
      productName={data.name}
      backLabel={dictionary.product.backToProducts}
      closeLabel={dictionary.product.closeDetails}
      intercepted
    >
      <ProductDetailContent data={data} locale={locale} />
    </ProductDetailModal>
  );
}
