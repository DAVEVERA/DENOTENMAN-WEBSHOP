import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { locales, isLocale } from "@/lib/i18n";
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
  params: Promise<{ locale: string; category: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale, category } = await params;

  if (!isLocale(rawLocale)) {
    return {};
  }

  const locale = rawLocale;
  const data = await getCategory(category, locale);

  if (!data) {
    return {};
  }

  return {
    alternates: {
      canonical: categoryPath(locale, data.slug),
      languages: Object.fromEntries(
        locales.flatMap((loc) => {
          const slug = data.slugsByLocale[loc];
          return slug ? [[loc, categoryPath(loc, slug)] as const] : [];
        })
      ),
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
