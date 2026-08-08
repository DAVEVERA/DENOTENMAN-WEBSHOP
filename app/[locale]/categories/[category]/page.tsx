import type { Locale } from "@/lib/i18n";
import { locales } from "@/lib/i18n";
import { getCategory } from "@/lib/queries";

const categorySlugs = ["puffs", "chips", "pops", "protein", "all"] as const;

export function generateStaticParams() {
  return locales.flatMap((locale) =>
    categorySlugs.map((category) => ({ locale, category }))
  );
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ locale: Locale; category: string }>;
}) {
  const { locale, category } = await params;
  const data = await getCategory(category, locale);

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
