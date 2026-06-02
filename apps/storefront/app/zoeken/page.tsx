import type { Metadata } from "next";
import { ProductGrid } from "../../components/product/ProductGrid";
import { listProducts } from "../../lib/products";
import { SITE_NAME } from "../../lib/seo";

type SearchPageProps = {
  searchParams?: Promise<{
    query?: string;
  }>;
};

export const metadata: Metadata = {
  title: {
    absolute: `Zoeken | ${SITE_NAME}`,
  },
  description: "Zoek in het assortiment van De Notenman.",
  alternates: {
    canonical: "/zoeken",
  },
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = params?.query?.trim() ?? "";
  const products = await listProducts();

  return (
    <main className="business-page">
      <section className="container list-page">
        <div>
          <h1>Zoeken</h1>
          <p>
            Zoek in het complete assortiment noten, mixen, pitten, zaden en gedroogd fruit.
          </p>
        </div>

        <ProductGrid products={products} initialQuery={query} showFilters />
      </section>
    </main>
  );
}
