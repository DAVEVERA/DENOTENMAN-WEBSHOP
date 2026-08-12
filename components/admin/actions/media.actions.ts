"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "../lib/admin-auth";
import { createAuditLog } from "../lib/audit";
import {
  deleteProductMedia,
  setProductPrimaryMedia,
  updateProductMedia,
  uploadProductImage,
} from "../lib/products";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getNumber(formData: FormData, key: string) {
  const value = Number(getString(formData, key).replace(",", "."));

  if (!Number.isFinite(value)) {
    throw new Error(`Ongeldige waarde voor ${key}.`);
  }

  return value;
}

export async function uploadProductMediaAction(formData: FormData) {
  const session = await requireAdmin();

  const productId = getNumber(formData, "productId");
  const slug = getString(formData, "slug") || `product-${productId}`;
  const file = formData.get("imageFile");

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Kies eerst een productfoto.");
  }

  await uploadProductImage(file, slug, productId);
  await createAuditLog({
    actorEmail: session.email,
    action: "Productfoto geupload",
    entityType: "product",
    entityId: productId,
  });
  revalidatePath(`/producten/${productId}`);
  revalidatePath(`/producten/${productId}/media`);
  revalidatePath("/media");
}

export async function updateProductMediaAction(formData: FormData) {
  const session = await requireAdmin();

  const productId = getNumber(formData, "productId");
  const mediaId = getString(formData, "mediaId");

  if (!mediaId) {
    throw new Error("Media-id ontbreekt.");
  }

  await updateProductMedia({
    productId,
    mediaId,
    altText: getString(formData, "altText") || null,
    sortOrder: getNumber(formData, "sortOrder"),
  });
  await createAuditLog({
    actorEmail: session.email,
    action: "Productfoto bijgewerkt",
    entityType: "product_media",
    entityId: mediaId,
  });

  revalidatePath(`/producten/${productId}`);
  revalidatePath(`/producten/${productId}/media`);
  revalidatePath("/media");
}

export async function setPrimaryProductMediaAction(formData: FormData) {
  const session = await requireAdmin();

  const productId = getNumber(formData, "productId");
  const mediaId = getString(formData, "mediaId");

  if (!mediaId) {
    throw new Error("Media-id ontbreekt.");
  }

  await setProductPrimaryMedia(productId, mediaId);
  await createAuditLog({
    actorEmail: session.email,
    action: "Producthoofdfoto gewijzigd",
    entityType: "product_media",
    entityId: mediaId,
  });
  revalidatePath(`/producten/${productId}`);
  revalidatePath(`/producten/${productId}/media`);
  revalidatePath("/media");
}

export async function deleteProductMediaAction(formData: FormData) {
  const session = await requireAdmin();

  const productId = getNumber(formData, "productId");
  const mediaId = getString(formData, "mediaId");

  if (!mediaId) {
    throw new Error("Media-id ontbreekt.");
  }

  await deleteProductMedia(productId, mediaId);
  await createAuditLog({
    actorEmail: session.email,
    action: "Productfoto verwijderd",
    entityType: "product_media",
    entityId: mediaId,
  });
  revalidatePath(`/producten/${productId}`);
  revalidatePath(`/producten/${productId}/media`);
  revalidatePath("/media");
}
