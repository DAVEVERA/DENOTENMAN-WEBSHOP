import "server-only";
import { createAdminSupabaseClient } from "./supabase/server";

export type AdminProduct = {
  id: number;
  name: string;
  slug: string;
  category: string;
  categoryLabel: string | null;
  image: string | null;
  description: string | null;
  basePrice: number;
  unit: string | null;
  badge: string | null;
  origin: string | null;
  isActive: boolean;
};

export type AdminProductWeight = {
  id: string;
  productId: number;
  label: string;
  grams: number;
  price: number;
};

export type AdminProductVariant = {
  id: string;
  productId: number;
  variantId: string;
  name: string;
  price: number;
  image: string | null;
  sku: string | null;
  stockStatus: string;
  stockLabel: string;
};

export type AdminProductMedia = {
  id: string;
  productId: number;
  bucket: string;
  objectPath: string;
  publicUrl: string;
  altText: string | null;
  sortOrder: number;
  isPrimary: boolean;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type AdminCategorySummary = {
  id: string;
  label: string;
  productCount: number;
  activeProductCount: number;
};

export type AdminInventoryItem = {
  productId: number;
  productName: string;
  productSlug: string;
  variantId: string;
  variantName: string;
  sku: string | null;
  stockStatus: string;
  stockLabel: string;
  isActive: boolean;
};

type ProductRow = {
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
};

type WeightRow = {
  id: string;
  product_id: number;
  label: string;
  grams: number;
  price: number | string;
};

type VariantRow = {
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

type ProductMediaRow = {
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

const productColumns =
  "id,name,slug,category,category_label,image,description,base_price,unit,badge,origin,is_active";
const productMediaColumns =
  "id,product_id,bucket,object_path,public_url,alt_text,sort_order,is_primary,mime_type,size_bytes,created_at,updated_at";
const productImageBucket = "product-images";
const allowedProductImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxProductImageBytes = 8 * 1024 * 1024;

function mapProduct(row: ProductRow): AdminProduct {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    category: row.category,
    categoryLabel: row.category_label,
    image: row.image,
    description: row.description,
    basePrice: Number(row.base_price),
    unit: row.unit,
    badge: row.badge,
    origin: row.origin,
    isActive: row.is_active !== false,
  };
}

function mapWeight(row: WeightRow): AdminProductWeight {
  return {
    id: row.id,
    productId: row.product_id,
    label: row.label,
    grams: row.grams,
    price: Number(row.price),
  };
}

function mapVariant(row: VariantRow): AdminProductVariant {
  return {
    id: row.id,
    productId: row.product_id,
    variantId: row.variant_id,
    name: row.name,
    price: Number(row.price),
    image: row.image,
    sku: row.sku,
    stockStatus: row.stock_status ?? "in_stock",
    stockLabel: row.stock_label ?? "Op voorraad",
  };
}

function mapProductMedia(row: ProductMediaRow): AdminProductMedia {
  return {
    id: row.id,
    productId: row.product_id,
    bucket: row.bucket,
    objectPath: row.object_path,
    publicUrl: row.public_url,
    altText: row.alt_text,
    sortOrder: row.sort_order ?? 0,
    isPrimary: row.is_primary === true,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes === null ? null : Number(row.size_bytes),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function formatAdminPrice(value: number) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

export function slugifyProductName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function listAdminProducts(searchQuery?: string) {
  const query = searchQuery?.trim();
  const supabase = createAdminSupabaseClient();
  let request = supabase
    .from("products")
    .select(productColumns)
    .order("name", { ascending: true });

  if (query) {
    const term = query.replace(/[%_]/g, "\\$&");
    request = request.or(
      `name.ilike.%${term}%,slug.ilike.%${term}%,category.ilike.%${term}%,category_label.ilike.%${term}%`,
    );
  }

  const { data, error } = await request;

  if (error) {
    throw new Error(error.message);
  }

  return (data as ProductRow[]).map(mapProduct);
}

export async function listAdminCategories(): Promise<AdminCategorySummary[]> {
  const supabase = createAdminSupabaseClient();
  const [{ data: categoryRows }, products] = await Promise.all([
    supabase
      .from("categories")
      .select("id,name,slug,is_active,sort_order")
      .order("sort_order", { ascending: true }),
    listAdminProducts(),
  ]);
  const categories = new Map<string, AdminCategorySummary>();

  for (const category of categoryRows ?? []) {
    const id = String((category as any).slug ?? (category as any).id);
    categories.set(id, {
      id,
      label: String((category as any).name ?? id),
      productCount: 0,
      activeProductCount: 0,
    });
  }

  for (const product of products) {
    const id = product.category || "overig";
    const current =
      categories.get(id) ??
      ({
        id,
        label: product.categoryLabel ?? id,
        productCount: 0,
        activeProductCount: 0,
      } satisfies AdminCategorySummary);

    current.productCount += 1;
    current.activeProductCount += product.isActive ? 1 : 0;

    if (!current.label && product.categoryLabel) {
      current.label = product.categoryLabel;
    }

    categories.set(id, current);
  }

  return Array.from(categories.values()).sort((left, right) =>
    left.label.localeCompare(right.label, "nl"),
  );
}

export async function getAdminCategory(id: string) {
  const categories = await listAdminCategories();
  return categories.find((category) => category.id === id) ?? null;
}

export async function listProductsByAdminCategory(id: string) {
  const products = await listAdminProducts();
  return products.filter((product) => product.category === id);
}

export async function listInventoryItems(): Promise<AdminInventoryItem[]> {
  const [products, variants] = await Promise.all([
    listAdminProducts(),
    (async () => {
      const supabase = createAdminSupabaseClient();
      const { data, error } = await supabase
        .from("product_variants")
        .select("id,product_id,variant_id,name,sku,stock_status,stock_label")
        .order("product_id", { ascending: true });

      if (error) throw new Error(error.message);
      return data as Array<{
        product_id: number;
        variant_id: string;
        name: string;
        sku: string | null;
        stock_status: string | null;
        stock_label: string | null;
      }>;
    })(),
  ]);
  const productsById = new Map(products.map((product) => [product.id, product]));

  return variants
    .map((variant) => {
      const product = productsById.get(variant.product_id);

      return {
        productId: variant.product_id,
        productName: product?.name ?? `Product ${variant.product_id}`,
        productSlug: product?.slug ?? String(variant.product_id),
        variantId: variant.variant_id,
        variantName: variant.name,
        sku: variant.sku,
        stockStatus: variant.stock_status ?? "in_stock",
        stockLabel: variant.stock_label ?? "Op voorraad",
        isActive: product?.isActive ?? false,
      };
    })
    .sort((left, right) => left.productName.localeCompare(right.productName, "nl"));
}

export async function getAdminProduct(id: number) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("products")
    .select(productColumns)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapProduct(data as ProductRow) : null;
}

export async function listProductWeights(productId: number) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("product_weights")
    .select("id,product_id,label,grams,price")
    .eq("product_id", productId)
    .order("grams", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data as WeightRow[]).map(mapWeight);
}

export async function listProductVariants(productId: number) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("product_variants")
    .select("id,product_id,variant_id,name,price,image,sku,stock_status,stock_label")
    .eq("product_id", productId)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data as VariantRow[]).map(mapVariant);
}

export async function listProductMedia(productId: number) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("product_media")
    .select(productMediaColumns)
    .eq("product_id", productId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data as ProductMediaRow[]).map(mapProductMedia);
}

export async function getNextProductId() {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("products")
    .select("id")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Number(data?.id ?? 1000) + 1;
}

function validateProductImage(file: File) {
  if (file.size === 0) {
    throw new Error("Het afbeeldingsbestand is leeg.");
  }

  if (file.size > maxProductImageBytes) {
    throw new Error("Productfoto is te groot. Upload maximaal 8 MB.");
  }

  if (!allowedProductImageTypes.has(file.type)) {
    throw new Error("Alleen JPG, PNG en WebP productfoto's zijn toegestaan.");
  }
}

export async function uploadProductImage(file: File, productSlug: string, productId: number) {
  validateProductImage(file);
  const supabase = createAdminSupabaseClient();
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeSlug = slugifyProductName(productSlug) || "product";
  const path = `${safeSlug}/${Date.now()}.${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage.from("product-images").upload(path, buffer, {
    cacheControl: "31536000",
    contentType: file.type || "image/jpeg",
    upsert: true,
  });

  if (error) {
    throw new Error(error.message);
  }

  const { data } = supabase.storage.from("product-images").getPublicUrl(path);
  const media = await createProductMedia({
    productId,
    bucket: productImageBucket,
    objectPath: path,
    publicUrl: data.publicUrl,
    altText: productSlug,
    mimeType: file.type || "image/jpeg",
    sizeBytes: file.size,
    isPrimary: true,
  });

  return media.publicUrl;
}

export async function upsertAdminProduct(input: AdminProduct) {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("products").upsert(
    {
      id: input.id,
      name: input.name,
      slug: input.slug,
      category: input.category,
      category_label: input.categoryLabel,
      image: input.image,
      description: input.description,
      base_price: input.basePrice,
      unit: input.unit,
      badge: input.badge,
      origin: input.origin,
      is_active: input.isActive,
    },
    { onConflict: "id" },
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteAdminProduct(productId: number) {
  const product = await getAdminProduct(productId);

  if (!product) {
    throw new Error("Product niet gevonden.");
  }

  const supabase = createAdminSupabaseClient();
  const media = await listProductMedia(productId);
  const { error } = await supabase.from("products").delete().eq("id", productId);

  if (error) {
    throw new Error(error.message);
  }

  const mediaByBucket = new Map<string, string[]>();

  for (const item of media) {
    mediaByBucket.set(item.bucket, [...(mediaByBucket.get(item.bucket) ?? []), item.objectPath]);
  }

  await Promise.all(
    Array.from(mediaByBucket.entries()).map(async ([bucket, paths]) => {
      await supabase.storage.from(bucket).remove(paths);
      await supabase.from("media_assets").delete().eq("bucket", bucket).in("object_path", paths);
    }),
  );

  return product;
}

export async function createProductMedia(input: {
  productId: number;
  bucket: string;
  objectPath: string;
  publicUrl: string;
  altText: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  isPrimary?: boolean;
}) {
  const supabase = createAdminSupabaseClient();
  const existing = await listProductMedia(input.productId);
  const shouldBePrimary = input.isPrimary === true || existing.length === 0;
  const sortOrder = existing.length;

  if (shouldBePrimary) {
    await clearProductPrimaryMedia(input.productId);
  }

  const { data, error } = await supabase
    .from("product_media")
    .insert({
      product_id: input.productId,
      bucket: input.bucket,
      object_path: input.objectPath,
      public_url: input.publicUrl,
      alt_text: input.altText,
      sort_order: sortOrder,
      is_primary: shouldBePrimary,
      mime_type: input.mimeType,
      size_bytes: input.sizeBytes,
    })
    .select(productMediaColumns)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await supabase.from("media_assets").upsert(
    {
      bucket: input.bucket,
      object_path: input.objectPath,
      public_url: input.publicUrl,
      filename: input.objectPath.split("/").pop() ?? input.objectPath,
      mime_type: input.mimeType,
      size_bytes: input.sizeBytes,
      source: "admin-product",
    },
    { onConflict: "bucket,object_path" },
  );

  if (shouldBePrimary) {
    await syncProductPrimaryImage(input.productId, input.publicUrl);
  }

  return mapProductMedia(data as ProductMediaRow);
}

async function clearProductPrimaryMedia(productId: number) {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("product_media")
    .update({ is_primary: false, updated_at: new Date().toISOString() })
    .eq("product_id", productId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function syncProductPrimaryImage(productId: number, publicUrl: string | null) {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("products").update({ image: publicUrl }).eq("id", productId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function setProductPrimaryMedia(productId: number, mediaId: string) {
  const supabase = createAdminSupabaseClient();
  await clearProductPrimaryMedia(productId);

  const { data, error } = await supabase
    .from("product_media")
    .update({ is_primary: true, updated_at: new Date().toISOString() })
    .eq("id", mediaId)
    .eq("product_id", productId)
    .select(productMediaColumns)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const media = mapProductMedia(data as ProductMediaRow);
  await syncProductPrimaryImage(productId, media.publicUrl);
  return media;
}

export async function updateProductMedia(input: {
  productId: number;
  mediaId: string;
  altText: string | null;
  sortOrder: number;
}) {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("product_media")
    .update({
      alt_text: input.altText,
      sort_order: input.sortOrder,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.mediaId)
    .eq("product_id", input.productId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteProductMedia(productId: number, mediaId: string) {
  const supabase = createAdminSupabaseClient();
  const media = (await listProductMedia(productId)).find((item) => item.id === mediaId);

  if (!media) {
    throw new Error("Productfoto niet gevonden.");
  }

  const { error } = await supabase
    .from("product_media")
    .delete()
    .eq("id", mediaId)
    .eq("product_id", productId);

  if (error) {
    throw new Error(error.message);
  }

  await supabase.storage.from(media.bucket).remove([media.objectPath]);

  if (media.isPrimary) {
    const [nextMedia] = await listProductMedia(productId);
    if (nextMedia) {
      await setProductPrimaryMedia(productId, nextMedia.id);
    } else {
      await syncProductPrimaryImage(productId, null);
    }
  }
}

export async function upsertProductWeight(input: {
  productId: number;
  label: string;
  grams: number;
  price: number;
}) {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("product_weights").upsert(
    {
      product_id: input.productId,
      label: input.label,
      grams: input.grams,
      price: input.price,
    },
    { onConflict: "product_id,grams" },
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteProductWeight(id: string) {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("product_weights").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function upsertProductVariant(input: {
  productId: number;
  variantId: string;
  name: string;
  price: number;
  image: string | null;
  sku: string | null;
  stockStatus: string;
  stockLabel: string;
}) {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("product_variants").upsert(
    {
      product_id: input.productId,
      variant_id: input.variantId,
      name: input.name,
      price: input.price,
      image: input.image,
      sku: input.sku,
      stock_status: input.stockStatus,
      stock_label: input.stockLabel,
    },
    { onConflict: "product_id,variant_id" },
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteProductVariant(id: string) {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("product_variants").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}
