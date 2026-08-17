import { revalidatePath } from "next/cache";
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
  const failedPaths: string[] = [];

  for (const path of productRevalidationPaths(input)) {
    try {
      revalidatePath(path);
    } catch (error) {
      failedPaths.push(path);
      console.error("Failed to revalidate product storefront path", {
        productId: input.productId,
        path,
        error,
      });
    }
  }

  return { frontendSynced: failedPaths.length === 0, failedPaths };
}
