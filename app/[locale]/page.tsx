import { notFound } from "next/navigation";
import { locales, isLocale } from "@/lib/i18n";
import { getFilteredProducts } from "@/lib/queries";
import { Container } from "@/components/ui/Container";
import { ProductCard } from "@/components/product/ProductCard";

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
  const products = await getFilteredProducts("all", locale, []);

  return (
    <Container className="py-10">
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((item) => (
          <ProductCard key={item.id} product={item} locale={locale} />
        ))}
      </div>
    </Container>
  );
}
