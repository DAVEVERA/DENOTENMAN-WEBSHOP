"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "../lib/admin-auth";
import { createAuditLog } from "../lib/audit";
import {
  deleteAdminProduct,
  deleteProductVariant,
  deleteProductWeight,
  getAdminProduct,
  getNextProductId,
  slugifyProductName,
  uploadProductImage,
  upsertAdminProduct,
  upsertProductVariant,
  upsertProductWeight,
} from "../lib/products";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getNullableString(formData: FormData, key: string) {
  const value = getString(formData, key);
  return value.length > 0 ? value : null;
}

function getNumber(formData: FormData, key: string) {
  const value = Number(getString(formData, key).replace(",", "."));

  if (!Number.isFinite(value)) {
    throw new Error(`Ongeldige waarde voor ${key}.`);
  }

  return value;
}

export async function saveProductAction(formData: FormData) {
  const session = await requireAdmin();

  const rawId = getString(formData, "id");
  const id = rawId ? Number(rawId) : await getNextProductId();
  const name = getString(formData, "name");
  const slug = getString(formData, "slug") || slugifyProductName(name);
  const existingProduct = rawId ? await getAdminProduct(id) : null;

  if (!name || !slug) {
    throw new Error("Productnaam en slug zijn verplicht.");
  }

  const file = formData.get("imageFile");
  const fallbackImage = getNullableString(formData, "image") ?? existingProduct?.image ?? null;

  await upsertAdminProduct({
    id,
    name,
    slug,
    category: getString(formData, "category") || "overig",
    categoryLabel: getNullableString(formData, "categoryLabel"),
    image: fallbackImage,
    description: getNullableString(formData, "description"),
    basePrice: getNumber(formData, "basePrice"),
    unit: getNullableString(formData, "unit"),
    badge: getNullableString(formData, "badge"),
    origin: getNullableString(formData, "origin"),
    isActive: formData.get("isActive") === "on",
  });

  if (file instanceof File && file.size > 0) {
    const uploadedImage = await uploadProductImage(file, slug, id);
    await upsertAdminProduct({
      id,
      name,
      slug,
      category: getString(formData, "category") || "overig",
      categoryLabel: getNullableString(formData, "categoryLabel"),
      image: uploadedImage,
      description: getNullableString(formData, "description"),
      basePrice: getNumber(formData, "basePrice"),
      unit: getNullableString(formData, "unit"),
      badge: getNullableString(formData, "badge"),
      origin: getNullableString(formData, "origin"),
      isActive: formData.get("isActive") === "on",
    });
  }

  await createAuditLog({
    actorEmail: session.email,
    action: rawId ? "Product bijgewerkt" : "Product aangemaakt",
    entityType: "product",
    entityId: id,
  });

  revalidatePath("/producten");
  revalidatePath(`/producten/${id}`);
  revalidatePath(`/producten/${id}/media`);
  revalidatePath("/media");
  revalidatePath("/winkel");
  revalidatePath(`/winkel/${slug}`);

  redirect(`/producten/${id}`);
}

export async function saveProductWeightAction(formData: FormData) {
  const session = await requireAdmin();

  const productId = getNumber(formData, "productId");
  const label = getString(formData, "label");
  const grams = getNumber(formData, "grams");
  const price = getNumber(formData, "price");

  if (!label) {
    throw new Error("Gewichtlabel is verplicht.");
  }

  await upsertProductWeight({
    productId,
    label,
    grams,
    price,
  });
  await createAuditLog({
    actorEmail: session.email,
    action: "Productgewicht opgeslagen",
    entityType: "product",
    entityId: productId,
  });

  revalidatePath(`/producten/${productId}`);
  revalidatePath(`/producten/${productId}/varianten`);
  revalidatePath("/winkel");
}

export async function deleteProductWeightAction(formData: FormData) {
  const session = await requireAdmin();

  const productId = getNumber(formData, "productId");
  const id = getString(formData, "id");

  if (!id) {
    throw new Error("Gewicht-id ontbreekt.");
  }

  await deleteProductWeight(id);
  await createAuditLog({
    actorEmail: session.email,
    action: "Productgewicht verwijderd",
    entityType: "product_weight",
    entityId: id,
  });
  revalidatePath(`/producten/${productId}`);
  revalidatePath(`/producten/${productId}/varianten`);
  revalidatePath("/winkel");
}

export async function saveProductVariantAction(formData: FormData) {
  const session = await requireAdmin();

  const productId = getNumber(formData, "productId");
  const name = getString(formData, "name");
  const variantId = getString(formData, "variantId") || slugifyProductName(name);

  if (!name || !variantId) {
    throw new Error("Variantnaam is verplicht.");
  }

  await upsertProductVariant({
    productId,
    variantId,
    name,
    price: getNumber(formData, "price"),
    image: getNullableString(formData, "image"),
    sku: getNullableString(formData, "sku"),
    stockStatus: getString(formData, "stockStatus") || "in_stock",
    stockLabel: getString(formData, "stockLabel") || "Op voorraad",
  });
  await createAuditLog({
    actorEmail: session.email,
    action: "Productvariant opgeslagen",
    entityType: "product",
    entityId: productId,
  });

  revalidatePath(`/producten/${productId}`);
  revalidatePath(`/producten/${productId}/varianten`);
  revalidatePath("/winkel");
}

export async function deleteProductVariantAction(formData: FormData) {
  const session = await requireAdmin();

  const productId = getNumber(formData, "productId");
  const id = getString(formData, "id");

  if (!id) {
    throw new Error("Variant-id ontbreekt.");
  }

  await deleteProductVariant(id);
  await createAuditLog({
    actorEmail: session.email,
    action: "Productvariant verwijderd",
    entityType: "product_variant",
    entityId: id,
  });
  revalidatePath(`/producten/${productId}`);
  revalidatePath(`/producten/${productId}/varianten`);
  revalidatePath("/winkel");
}

export async function hideProductAction(formData: FormData) {
  const session = await requireAdmin();

  const productId = getNumber(formData, "productId");
  const product = await getAdminProduct(productId);

  if (!product) {
    throw new Error("Product niet gevonden.");
  }

  await upsertAdminProduct({
    ...product,
    isActive: false,
  });
  await createAuditLog({
    actorEmail: session.email,
    action: "Product verborgen",
    entityType: "product",
    entityId: productId,
  });

  revalidatePath("/producten");
  revalidatePath(`/producten/${productId}`);
  revalidatePath("/winkel");
}

export async function showProductAction(formData: FormData) {
  const session = await requireAdmin();

  const productId = getNumber(formData, "productId");
  const product = await getAdminProduct(productId);

  if (!product) {
    throw new Error("Product niet gevonden.");
  }

  await upsertAdminProduct({
    ...product,
    isActive: true,
  });
  await createAuditLog({
    actorEmail: session.email,
    action: "Product zichtbaar gemaakt",
    entityType: "product",
    entityId: productId,
  });

  revalidatePath("/producten");
  revalidatePath(`/producten/${productId}`);
  revalidatePath("/winkel");
}

export async function deleteProductAction(formData: FormData) {
  const session = await requireAdmin();

  const productId = getNumber(formData, "productId");
  const confirmation = getString(formData, "confirmation");

  if (confirmation !== "VERWIJDEREN") {
    throw new Error("Typ VERWIJDEREN om dit product definitief te verwijderen.");
  }

  const product = await deleteAdminProduct(productId);
  await createAuditLog({
    actorEmail: session.email,
    action: "Product verwijderd",
    entityType: "product",
    entityId: productId,
  });

  revalidatePath("/producten");
  revalidatePath(`/producten/${productId}`);
  revalidatePath(`/producten/${productId}/media`);
  revalidatePath(`/producten/${productId}/varianten`);
  revalidatePath("/media");
  revalidatePath("/winkel");
  revalidatePath(`/winkel/${product.slug}`);

  redirect("/producten");
}
