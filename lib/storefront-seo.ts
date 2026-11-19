export function resolvePromotionalCategorySlug(
  categories: Array<{ slug: string; type: string }>
): string | undefined {
  return categories.find((category) => category.type === "PROMOTIONAL")?.slug;
}
