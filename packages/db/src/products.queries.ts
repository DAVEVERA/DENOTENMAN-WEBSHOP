import { unwrapSupabaseResult, type SupabaseLikeClient } from "./client";
import type {
  ProductRow,
  ProductMediaRow,
  ProductVariantRow,
  ProductVariantWriteInput,
  ProductWeightRow,
  ProductWeightWriteInput,
  ProductWithRelations,
  ProductWriteInput,
} from "./types";

type QueryBuilder<T> = PromiseLike<{ data: T | null; error: { message: string } | null }>;

function asQuery<T>(value: unknown): QueryBuilder<T> {
  return value as QueryBuilder<T>;
}

export async function listActiveProducts(client: SupabaseLikeClient) {
  const query = client
    .from("products")
    .select("id,name,slug,category,category_label,image,description,base_price,unit,badge,origin,is_active,created_at,weights");

  const products = await unwrapSupabaseResult<ProductRow[]>(asQuery<ProductRow[]>(query));
  return products.filter((product) => product.is_active !== false);
}

export async function getProductBySlug(client: SupabaseLikeClient, slug: string) {
  const query = client
    .from("products")
    .select("id,name,slug,category,category_label,image,description,base_price,unit,badge,origin,is_active,created_at,weights");

  const products = await unwrapSupabaseResult<ProductRow[]>(asQuery<ProductRow[]>(query));
  return products.find((product) => product.slug === slug && product.is_active !== false) ?? null;
}

export async function listProductVariants(client: SupabaseLikeClient, productId: number) {
  const query = client
    .from("product_variants")
    .select("id,product_id,variant_id,name,price,image,sku,stock_status,stock_label");

  const variants = await unwrapSupabaseResult<ProductVariantRow[]>(
    asQuery<ProductVariantRow[]>(query),
  );

  return variants.filter((variant) => variant.product_id === productId);
}

export async function listProductWeights(client: SupabaseLikeClient, productId: number) {
  const query = client.from("product_weights").select("id,product_id,label,grams,price");
  const weights = await unwrapSupabaseResult<ProductWeightRow[]>(asQuery<ProductWeightRow[]>(query));
  return weights.filter((weight) => weight.product_id === productId);
}

export async function listProductMedia(client: SupabaseLikeClient, productId: number) {
  const query = client
    .from("product_media")
    .select("id,product_id,bucket,object_path,public_url,alt_text,sort_order,is_primary,mime_type,size_bytes,created_at,updated_at");
  const media = await unwrapSupabaseResult<ProductMediaRow[]>(asQuery<ProductMediaRow[]>(query));
  return media
    .filter((item) => item.product_id === productId)
    .sort((left, right) => (left.sort_order ?? 0) - (right.sort_order ?? 0));
}

export async function getProductWithRelations(
  client: SupabaseLikeClient,
  slug: string,
): Promise<ProductWithRelations | null> {
  const product = await getProductBySlug(client, slug);

  if (!product) {
    return null;
  }

  const [variants, weights, media] = await Promise.all([
    listProductVariants(client, product.id),
    listProductWeights(client, product.id),
    listProductMedia(client, product.id),
  ]);

  return {
    ...product,
    variants,
    weights_list: weights,
    media,
  };
}

export async function upsertProduct(client: SupabaseLikeClient, input: ProductWriteInput) {
  const upsert = client.from("products").upsert;

  if (!upsert) {
    throw new Error("Supabase client does not support upsert.");
  }

  return unwrapSupabaseResult<ProductRow>(
    asQuery<ProductRow>(upsert(input, { onConflict: "id" })),
  );
}

export async function upsertProductVariant(
  client: SupabaseLikeClient,
  input: ProductVariantWriteInput,
) {
  const upsert = client.from("product_variants").upsert;

  if (!upsert) {
    throw new Error("Supabase client does not support upsert.");
  }

  return unwrapSupabaseResult<ProductVariantRow>(
    asQuery<ProductVariantRow>(upsert(input, { onConflict: "product_id,variant_id" })),
  );
}

export async function upsertProductWeight(
  client: SupabaseLikeClient,
  input: ProductWeightWriteInput,
) {
  const upsert = client.from("product_weights").upsert;

  if (!upsert) {
    throw new Error("Supabase client does not support upsert.");
  }

  return unwrapSupabaseResult<ProductWeightRow>(
    asQuery<ProductWeightRow>(upsert(input, { onConflict: "product_id,grams" })),
  );
}
