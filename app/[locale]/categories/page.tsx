import type { Locale } from "@/lib/i18n";
import { locales } from "@/lib/i18n";
import { getFilteredProducts } from "@/lib/queries";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function CategoriesPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const products = await getFilteredProducts("all", locale, []);

  return (
    <ul>
      {products.map((item) => (
        <li key={item.id}>{item.name}</li>
      ))}
    </ul>
  );
}
