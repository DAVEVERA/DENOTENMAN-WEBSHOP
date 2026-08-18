import { slugify } from "@/lib/slugify";

export type FrenchProductTranslation = {
  productId: string;
  name: string;
  slug: string;
};

export type PlannedFrenchProductSlug = FrenchProductTranslation & {
  nextSlug: string;
};

export function legacySlugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function wasGeneratedByLegacySlugifier(translation: FrenchProductTranslation): boolean {
  const legacySlug = legacySlugify(translation.name);
  const escapedLegacySlug = legacySlug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (
    translation.slug === legacySlug ||
    new RegExp(`^${escapedLegacySlug}-\\d+$`).test(translation.slug)
  );
}

export function planFrenchProductSlugs(
  translations: FrenchProductTranslation[]
): PlannedFrenchProductSlug[] {
  const groups = new Map<string, FrenchProductTranslation[]>();

  for (const translation of translations) {
    const baseSlug = slugify(translation.name);
    const group = groups.get(baseSlug) ?? [];
    group.push(translation);
    groups.set(baseSlug, group);
  }

  return [...groups.entries()]
    .flatMap(([baseSlug, group]) =>
      [...group]
        .sort((left, right) => {
          const leftUsesBase = Number(left.slug === baseSlug);
          const rightUsesBase = Number(right.slug === baseSlug);
          return (
            rightUsesBase - leftUsesBase ||
            left.slug.localeCompare(right.slug) ||
            left.productId.localeCompare(right.productId)
          );
        })
        .map((translation, index) => ({
          ...translation,
          nextSlug: index === 0 ? baseSlug : `${baseSlug}-${index}`,
        }))
    )
    .filter(
      (translation) =>
        translation.slug !== translation.nextSlug &&
        wasGeneratedByLegacySlugifier(translation)
    )
    .sort((left, right) => left.slug.localeCompare(right.slug));
}
