import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const productViewMinimumIntervalMs = 2_000;

export async function recordProductView(productId: string): Promise<boolean> {
  const product = await prisma.product.findFirst({
    where: { id: productId, isActive: true },
    select: { id: true },
  });
  if (!product) return false;

  const cutoff = new Date(Date.now() - productViewMinimumIntervalMs);
  const updated = await prisma.productViewMetric.updateMany({
    where: { productId, updatedAt: { lte: cutoff } },
    data: { viewCount: { increment: 1 } },
  });
  if (updated.count === 1) return true;

  try {
    await prisma.productViewMetric.create({
      data: { productId, viewCount: 1 },
    });
    return true;
  } catch (error) {
    // A row already exists but was updated too recently. Treat the request as
    // handled without incrementing again. Other failures remain visible.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return true;
    }
    throw error;
  }
}
