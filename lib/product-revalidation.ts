import { revalidatePath, revalidateTag } from "next/cache";
import {
  productRevalidationPaths,
  type ProductRevalidationInput,
} from "@/lib/product-visibility";

export type ProductRevalidationResult = {
  frontendSynced: boolean;
  failedPaths: string[];
};

export function revalidateProductStorefront(
  input: ProductRevalidationInput
): ProductRevalidationResult {
  const affectedPaths = productRevalidationPaths(input);

  try {
    // A single layout invalidation refreshes every storefront and admin surface
    // atomically. Calling revalidatePath once per localized URL made the save
    // response needlessly slow and could leave only part of the storefront fresh.
    revalidatePath("/", "layout");
    revalidateTag("google-merchant-products", "max");
  } catch (error) {
    console.error("Failed to revalidate product storefront", {
      productId: input.productId,
      affectedPaths,
      error,
    });
    return { frontendSynced: false, failedPaths: affectedPaths };
  }

  return { frontendSynced: true, failedPaths: [] };
}
