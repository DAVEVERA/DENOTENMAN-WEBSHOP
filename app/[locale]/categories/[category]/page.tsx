import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n";
import { locales } from "@/lib/i18n";
import { category as categoryPath } from "@/lib/routes";
import { getCategory, getCategorySlugs } from "@/lib/queries";

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
  params: Promise<{ locale: Locale; category: string }>;
}): Promise<Metadata> {
  const { locale, category } = await params;
  const data = await getCategory(category, locale);

  if (!data) {
    return {};
  }

  return {
    alternates: {
      canonical: categoryPath(locale, data.slug),
      languages: Object.fromEntries(
        Object.entries(data.slugsByLocale).map(([loc, slug]) => [
          loc,
          categoryPath(loc as Locale, slug),
        ])
      ),
    },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ locale: Locale; category: string }>;
}) {
  const { locale, category } = await params;
  const data = await getCategory(category, locale);

  if (!data) {
    notFound();
  }

  return (
    <div>
      <h1>{data.name}</h1>
      <ul>
        {data.products.map((item) => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
    </div>
  );
}
