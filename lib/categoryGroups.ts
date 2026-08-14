import type { MainCategoryDto } from "@/lib/queries";

export const promotionalCategorySlug = "acties";

export const categoryGroupSlugs: readonly (readonly string[])[] = [
  ["noten", "notenmixen", "pinda-s", "pitten-zaden"],
  ["snacks-zoutjes"],
  ["gedroogd-fruit", "gekonfijt-fruit", "meel-griesmeel", "gedroogde-vruchten"],
  ["muesli-granen", "superfood"],
  ["chocolade-zoet"],
  ["honing-natuurvoeding"],
  ["notenpasta-s"],
  ["bakproducten"],
];

export type MainCategoryGroupDto = {
  label: string;
  primarySlug: string;
  categories: MainCategoryDto[];
};

export function groupMainCategories(categories: MainCategoryDto[]): {
  groups: MainCategoryGroupDto[];
  promotional?: MainCategoryDto;
} {
  const bySlug = new Map(categories.map((category) => [category.slug, category]));
  const assigned = new Set<string>();
  const groups: MainCategoryGroupDto[] = [];

  for (const slugs of categoryGroupSlugs) {
    const members = slugs
      .map((slug) => bySlug.get(slug))
      .filter((category): category is MainCategoryDto => Boolean(category));

    if (members.length === 0) continue;

    members.forEach((member) => assigned.add(member.slug));
    groups.push({
      label: members[0].name,
      primarySlug: members[0].slug,
      categories: members,
    });
  }

  const promotional = categories.find((category) => category.slug === promotionalCategorySlug);
  if (promotional) {
    assigned.add(promotional.slug);
  }

  for (const category of categories) {
    if (assigned.has(category.slug)) continue;
    groups.push({ label: category.name, primarySlug: category.slug, categories: [category] });
  }

  return { groups, promotional };
}
