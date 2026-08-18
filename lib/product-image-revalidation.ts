import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { buildProductIndexNowUrls, scheduleIndexNowUrls } from "@/lib/indexnow";
import { BASE_URL } from "@/lib/routes";

export async function revalidateProductImageStorefront(productId: string): Promise<void> {
  try {
    const product = await prisma.product.update({
      where: { id: productId },
      data: { updatedAt: new Date() },
      select: {
        translations: { select: { locale: true, slug: true } },
        productCategories: {
          select: {
            category: {
              select: { translations: { select: { locale: true, slug: true } } },
            },
          },
        },
      },
    });

    scheduleIndexNowUrls(
      buildProductIndexNowUrls({
        baseUrl: BASE_URL,
        translations: product.translations,
        categoryTranslations: product.productCategories.flatMap(
          (assignment) => assignment.category.translations
        ),
      })
    );
  } catch (error) {
    console.error("Failed to update product timestamp after image change", {
      productId,
      error,
    });
  }

  // Product imagery appears on product pages, home, categories, recommendations,
  // metadata and JSON-LD. Root-layout invalidation deliberately covers all of them.
  revalidatePath("/", "layout");
}
