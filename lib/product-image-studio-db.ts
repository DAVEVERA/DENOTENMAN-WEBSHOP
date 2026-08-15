import { Prisma } from "@prisma/client";
import type { ImageOrderRow } from "@/lib/product-image-studio";

export const productImageTransactionOptions = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 5_000,
  timeout: 30_000,
} as const;

export async function lockProductImages(tx: Prisma.TransactionClient, productId: string): Promise<void> {
  await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`product-images:${productId}`}))`);
}

export async function getOrderedProductImages(
  tx: Prisma.TransactionClient,
  productId: string
): Promise<Array<ImageOrderRow & { storageKey: string; alt: string | null }>> {
  return tx.productImage.findMany({
    where: { productId },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: { id: true, storageKey: true, alt: true, sortOrder: true, isPrimary: true },
  });
}

export async function applyProductImageOrder(
  tx: Prisma.TransactionClient,
  updates: ImageOrderRow[]
): Promise<void> {
  for (const update of updates) {
    await tx.productImage.update({
      where: { id: update.id },
      data: { sortOrder: update.sortOrder, isPrimary: update.isPrimary },
    });
  }
}
