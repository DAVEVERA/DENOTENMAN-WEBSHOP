export type ProductRow = {
  id: number;
  name: string;
  slug: string;
  category: string;
  category_label: string | null;
  image: string | null;
  description: string | null;
  base_price: number | string;
  unit: string | null;
  badge: string | null;
  origin: string | null;
  is_active: boolean | null;
  created_at: string;
  weights: unknown | null;
};

export type ProductVariantRow = {
  id: string;
  product_id: number;
  variant_id: string;
  name: string;
  price: number | string;
  image: string | null;
  sku: string | null;
  stock_status: string | null;
  stock_label: string | null;
};

export type ProductWeightRow = {
  id: string;
  product_id: number;
  label: string;
  grams: number;
  price: number | string;
};

export type ProductMediaRow = {
  id: string;
  product_id: number;
  bucket: string;
  object_path: string;
  public_url: string;
  alt_text: string | null;
  sort_order: number | null;
  is_primary: boolean | null;
  mime_type: string | null;
  size_bytes: number | string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type ProductImageBackupRow = {
  id: number | string | null;
  image: string | null;
  product_id?: number | null;
  backed_up_at: string | null;
};

export type ProductWithRelations = ProductRow & {
  variants: ProductVariantRow[];
  weights_list: ProductWeightRow[];
  media?: ProductMediaRow[];
};

export type ProductWriteInput = {
  id: number;
  name: string;
  slug: string;
  category: string;
  base_price: number;
  category_label?: string | null;
  image?: string | null;
  description?: string | null;
  unit?: string | null;
  badge?: string | null;
  origin?: string | null;
  is_active?: boolean;
};

export type ProductVariantWriteInput = {
  product_id: number;
  variant_id: string;
  name: string;
  price: number;
  image?: string | null;
  sku?: string | null;
  stock_status?: string | null;
  stock_label?: string | null;
};

export type ProductWeightWriteInput = {
  product_id: number;
  label: string;
  grams: number;
  price: number;
};
