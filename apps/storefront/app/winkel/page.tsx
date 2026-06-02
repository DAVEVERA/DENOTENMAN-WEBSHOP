import type { Metadata } from "next";
import { ProductGrid } from "../../components/product/ProductGrid";
import { listProducts } from "../../lib/products";
import { SITE_NAME } from "../../lib/seo";

export const metadata: Metadata = {
  title: {
    absolute: `Winkel | ${SITE_NAME}`,
  },
  description:
    "Bekijk het complete assortiment noten, pitten, zaden, snacks en gedroogd fruit van De Notenman.",
  alternates: {
    canonical: "/winkel",
  },
};

export default async function ShopPage() {
  const products = await listProducts();

  return (
    <main className="business-page">
      <section className="container list-page">
        <ProductGrid products={products} showFilters />
      </section>
    </main>
  );
}
