import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { locales, isLocale } from "@/lib/i18n";
import { getCategory, getCategorySlugs } from "@/lib/queries";
import { getAlternates } from "@/lib/alternates";
import { Container } from "@/components/ui/Container";
import { ProductCard } from "@/components/product/ProductCard";

export async function generateStaticParams() {
  const params = await Promise.all(
    locales.map(async (locale) => {
      const entries = await getCategorySlugs(locale);
      return entries.map((entry) => ({ locale, category: entry.slug }));
    })
  );

  return params.flat();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; category: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale, category } = await params;

  if (!isLocale(rawLocale)) {
    return {};
  }

  const alternates = await getAlternates(rawLocale, { type: "category", slug: category });

  if (!alternates) {
    return {};
  }

  return {
    alternates: {
      canonical: alternates.canonical,
      languages: alternates.languages,
    },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ locale: string; category: string }>;
}) {
  const { locale: rawLocale, category } = await params;

  if (!isLocale(rawLocale)) {
    notFound();
  }

  const locale = rawLocale;
  const data = await getCategory(category, locale);

  if (!data) {
    notFound();
  }

  return (
    <Container className="py-10">
      <h1 className="font-heading text-3xl tracking-heading text-text">{data.name}</h1>
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4">
        {data.products.map((item) => (
          <ProductCard key={item.id} product={item} categoryName={data.name} locale={locale} />
        ))}
      </div>
    </Container>
  );
}
