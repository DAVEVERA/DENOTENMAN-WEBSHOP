import type { StorefrontProduct } from "../../lib/products";
import { ProductGrid } from "./ProductGrid";

type RelatedProductsProps = {
  products: StorefrontProduct[];
};

export function RelatedProducts({ products }: RelatedProductsProps) {
  if (products.length === 0) {
    return null;
  }

  return (
    <section className="related-products">
      <h2>Ook interessant</h2>
      <ProductGrid products={products} />
    </section>
  );
}
