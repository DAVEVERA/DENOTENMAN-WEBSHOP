import { revalidatePath } from "next/cache";

export function revalidateProductImageStorefront(): void {
  // Product imagery appears on product pages, home, categories, recommendations,
  // metadata and JSON-LD. Root-layout invalidation deliberately covers all of them.
  revalidatePath("/", "layout");
}
