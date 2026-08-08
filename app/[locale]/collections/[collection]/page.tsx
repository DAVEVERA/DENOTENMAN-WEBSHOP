import type { Locale } from "@/lib/i18n";
import { locales } from "@/lib/i18n";
import { getCollection } from "@/lib/queries";

const collectionSlugs = ["puffs", "chips", "pops", "protein", "all"] as const;

export function generateStaticParams() {
  return locales.flatMap((locale) =>
    collectionSlugs.map((collection) => ({ locale, collection }))
  );
}

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ locale: Locale; collection: string }>;
}) {
  const { locale, collection } = await params;
  const data = await getCollection(collection, locale);

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
