export const frenchCategorySlugRedirects = [
  ["cacahu-tes", "cacahuetes"],
  ["m-langes-de-noix", "melanges-de-noix"],
  ["muesli-c-r-ales", "muesli-cereales"],
  ["produits-de-p-tisserie", "produits-de-patisserie"],
] as const;

export function resolveFrenchCategorySlug(slug: string): string | undefined {
  return frenchCategorySlugRedirects.find(([sourceSlug]) => sourceSlug === slug)?.[1];
}
