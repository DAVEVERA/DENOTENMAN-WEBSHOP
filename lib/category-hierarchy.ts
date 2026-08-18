export const MAX_CATEGORY_LEVELS = 3;

export type CategoryParentNode = {
  id: string;
  parentId: string | null;
};

export function collectDescendantCategoryIds(
  categoryId: string,
  categories: CategoryParentNode[]
): string[] {
  const childrenByParent = new Map<string, string[]>();
  for (const category of categories) {
    if (!category.parentId) continue;
    const children = childrenByParent.get(category.parentId) ?? [];
    children.push(category.id);
    childrenByParent.set(category.parentId, children);
  }

  const collected: string[] = [];
  const visited = new Set<string>();
  const pending = [categoryId];
  while (pending.length > 0) {
    const current = pending.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);
    collected.push(current);
    pending.push(...(childrenByParent.get(current) ?? []));
  }
  return collected;
}

export function validateCategoryParent(
  categoryId: string,
  nextParentId: string | null,
  categories: CategoryParentNode[]
): "SELF_PARENT" | "PARENT_NOT_FOUND" | "CATEGORY_CYCLE" | "CATEGORY_TOO_DEEP" | null {
  if (nextParentId === null) return null;
  if (nextParentId === categoryId) return "SELF_PARENT";

  const byId = new Map(categories.map((category) => [category.id, category]));
  if (!byId.has(nextParentId)) return "PARENT_NOT_FOUND";

  let currentId: string | null = nextParentId;
  let levels = 1;
  const visited = new Set<string>();
  while (currentId) {
    if (currentId === categoryId || visited.has(currentId)) return "CATEGORY_CYCLE";
    visited.add(currentId);
    const current = byId.get(currentId);
    if (!current) return "PARENT_NOT_FOUND";
    currentId = current.parentId;
    levels += 1;
  }

  if (levels > MAX_CATEGORY_LEVELS) return "CATEGORY_TOO_DEEP";

  const descendants = collectDescendantCategoryIds(categoryId, categories);
  const maxDescendantDistance = descendants.reduce((maximum, descendantId) => {
    if (descendantId === categoryId) return maximum;
    let distance = 0;
    let cursor: string | null = descendantId;
    const path = new Set<string>();
    while (cursor && cursor !== categoryId && !path.has(cursor)) {
      path.add(cursor);
      cursor = byId.get(cursor)?.parentId ?? null;
      distance += 1;
    }
    return cursor === categoryId ? Math.max(maximum, distance) : maximum;
  }, 0);

  return levels + maxDescendantDistance > MAX_CATEGORY_LEVELS
    ? "CATEGORY_TOO_DEEP"
    : null;
}
