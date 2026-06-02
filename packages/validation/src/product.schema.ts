export type ProductInput = {
  name: string;
  slug?: string;
  category: string;
  basePrice: number;
  unit?: string | null;
  description?: string | null;
  isActive?: boolean;
};

export type ProductVariantInput = {
  productId: number;
  name: string;
  variantId?: string;
  price: number;
  sku?: string | null;
  stockStatus?: "in_stock" | "limited" | "out_of_stock";
};

export function validateProductInput(input: ProductInput) {
  if (!input.name.trim()) throw new Error("Productnaam is verplicht.");
  if (!input.category.trim()) throw new Error("Categorie is verplicht.");
  if (!Number.isFinite(input.basePrice) || input.basePrice < 0) {
    throw new Error("Basisprijs moet een positief bedrag zijn.");
  }
  return input;
}

export function validateProductVariantInput(input: ProductVariantInput) {
  if (!Number.isInteger(input.productId) || input.productId <= 0) {
    throw new Error("Product-id is ongeldig.");
  }
  if (!input.name.trim()) throw new Error("Variantnaam is verplicht.");
  if (!Number.isFinite(input.price) || input.price < 0) {
    throw new Error("Variantprijs moet een positief bedrag zijn.");
  }
  return input;
}
