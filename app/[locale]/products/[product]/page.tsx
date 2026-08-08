import type { Locale } from "@/lib/i18n";
import { getProductBySlug } from "@/lib/queries";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: Locale; product: string }>;
}) {
  const { locale, product } = await params;
  const data = await getProductBySlug(product, locale);

  return (
    <div>
      <h1>{data.name}</h1>
      <p>{data.description}</p>
    </div>
  );
}
