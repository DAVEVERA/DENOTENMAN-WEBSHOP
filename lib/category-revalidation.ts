import { revalidatePath } from "next/cache";

export type CategoryRevalidationResult = {
  frontendSynced: boolean;
};

export function revalidateCategoryStorefront(
  categoryId: string
): CategoryRevalidationResult {
  try {
    // Categories feed the shared header, mobile navigation, homepage filters,
    // category pages and sitemap. The root layout is the common cache boundary.
    revalidatePath("/", "layout");
    return { frontendSynced: true };
  } catch (error) {
    console.error("Failed to revalidate category storefront", { categoryId, error });
    return { frontendSynced: false };
  }
}
