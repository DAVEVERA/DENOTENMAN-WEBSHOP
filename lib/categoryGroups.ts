import type { CategoryType } from "@prisma/client";

export type NavigationCategorySourceDto = {
  id: string;
  canonicalSlug: string;
  slug: string;
  name: string;
  description: string | null;
  type: CategoryType;
  parentId: string | null;
  sortOrder: number;
};

export type NavigationCategoryDto = Pick<
  NavigationCategorySourceDto,
  "id" | "canonicalSlug" | "slug" | "name" | "description" | "type"
> & {
  children: NavigationCategoryDto[];
};

export type CategoryNavigationDto = {
  categories: NavigationCategoryDto[];
  promotional?: NavigationCategoryDto;
};

export type MainCategoryGroupDto<T extends NavigationCategoryDto = NavigationCategoryDto> = {
  label: string;
  primarySlug: string;
  categories: T[];
};

// Temporary compatibility for the currently flat production data. These are
// canonical database slugs, never localized route slugs. A real parent/child
// relation on the parent always takes precedence over this fallback.
const legacyChildSlugsByParent = new Map<string, readonly string[]>([
  ["noten", ["notenmixen", "pinda-s", "pitten-zaden"]],
  ["gedroogd-fruit", ["gekonfijt-fruit", "meel-griesmeel", "gedroogde-vruchten"]],
  ["muesli-granen", ["superfood"]],
]);

/** Build one locale-correct navigation tree from the Prisma Category graph. */
export function buildCategoryNavigation(
  sources: NavigationCategorySourceDto[]
): CategoryNavigationDto {
  const ordered = [...sources].sort(
    (left, right) =>
      left.sortOrder - right.sortOrder || left.name.localeCompare(right.name)
  );
  const nodes = new Map<string, NavigationCategoryDto>();
  const byCanonicalSlug = new Map(ordered.map((source) => [source.canonicalSlug, source]));

  for (const source of ordered) {
    nodes.set(source.id, {
      id: source.id,
      canonicalSlug: source.canonicalSlug,
      slug: source.slug,
      name: source.name,
      description: source.description,
      type: source.type,
      children: [],
    });
  }

  for (const source of ordered) {
    if (!source.parentId) continue;
    const parent = nodes.get(source.parentId);
    const child = nodes.get(source.id);
    if (parent && child && parent !== child) parent.children.push(child);
  }

  const roots = ordered
    .filter((source) => source.parentId === null)
    .map((source) => nodes.get(source.id))
    .filter((category): category is NavigationCategoryDto => category !== undefined);
  const fallbackChildIds = new Set<string>();

  for (const [parentSlug, childSlugs] of legacyChildSlugsByParent) {
    const parentSource = byCanonicalSlug.get(parentSlug);
    const parent = parentSource ? nodes.get(parentSource.id) : undefined;
    if (!parentSource || !parent || parentSource.parentId !== null || parent.children.length > 0) {
      continue;
    }

    for (const childSlug of childSlugs) {
      const childSource = byCanonicalSlug.get(childSlug);
      const child = childSource ? nodes.get(childSource.id) : undefined;
      if (!childSource || !child || childSource.parentId !== null) continue;
      parent.children.push(child);
      fallbackChildIds.add(child.id);
    }
  }

  const visibleRoots = roots.filter((category) => !fallbackChildIds.has(category.id));
  const promotional = visibleRoots.find((category) => category.type === "PROMOTIONAL");

  return {
    categories: visibleRoots.filter((category) => category.type !== "PROMOTIONAL"),
    promotional,
  };
}

/** @deprecated Storefront navigation should use buildCategoryNavigation. */
export function groupMainCategories<
  T extends Pick<NavigationCategoryDto, "id" | "slug" | "name" | "type">
>(categories: T[]): {
  groups: Array<{ label: string; primarySlug: string; categories: T[] }>;
  promotional?: T;
} {
  const promotional = categories.find((category) => category.type === "PROMOTIONAL");
  return {
    groups: categories
      .filter((category) => category.type !== "PROMOTIONAL")
      .map((category) => ({
        label: category.name,
        primarySlug: category.slug,
        categories: [category],
      })),
    promotional,
  };
}
