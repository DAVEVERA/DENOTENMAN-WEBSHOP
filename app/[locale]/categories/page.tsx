import { notFound } from "next/navigation";
import { locales, isLocale } from "@/lib/i18n";
import { getFilteredProducts } from "@/lib/queries";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function CategoriesPage({
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
    <ul>
      {products.map((item) => (
        <li key={item.id}>{item.name}</li>
      ))}
    </ul>
  );
}
