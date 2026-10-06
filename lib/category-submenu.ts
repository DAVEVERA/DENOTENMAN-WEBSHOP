// The submenu of a main category, in one place: the header dropdown and the category
// pages (tile grid) both read it, so they cannot drift apart. Noten, Muesli and Snacks
// use the real child categories; Gedroogd fruit, Honing and Notenpasta have no child
// categories, so their submenu is the fixed list of catalogue filters below.

import type { NavigationCategoryDto } from "@/lib/categoryGroups";
import { findCategoryByCanonicalSlug } from "@/lib/categoryGroups";
import type { Locale } from "@/lib/i18n";
import { categories as categoriesPath, category as categoryPath } from "@/lib/routes";

export type SearchSubcategory = {
  key: string;
  label: Record<Locale, string>;
  query?: Record<Locale, string>;
};

export const driedFruitSubcategories: SearchSubcategory[] = [
  { key: "dates", label: { nl: "Dadels", en: "Dates", fr: "Dattes" }, query: { nl: "dadels", en: "dates", fr: "dattes" } },
  { key: "figs", label: { nl: "Vijgen", en: "Figs", fr: "Figues" }, query: { nl: "vijgen", en: "figs", fr: "figues" } },
  { key: "raisins", label: { nl: "Rozijnen", en: "Raisins", fr: "Raisins secs" }, query: { nl: "rozijnen", en: "raisins", fr: "raisins" } },
  { key: "apricots", label: { nl: "Abrikozen", en: "Apricots", fr: "Abricots" }, query: { nl: "abrikozen", en: "apricots", fr: "abricots" } },
  { key: "tropical", label: { nl: "Mango & tropisch fruit", en: "Mango & tropical fruit", fr: "Mangue & fruits tropicaux" }, query: { nl: "mango", en: "mango", fr: "mangue" } },
  { key: "all-fruit", label: { nl: "Alle gedroogde vruchten", en: "All dried fruit", fr: "Tous les fruits secs" } },
];

export const honeySubcategories: SearchSubcategory[] = [
  { key: "flower-honey", label: { nl: "Bloemenhoning", en: "Flower honey", fr: "Miel de fleurs" }, query: { nl: "bloemenhoning", en: "flower honey", fr: "miel de fleurs" } },
  { key: "liquid-honey", label: { nl: "Vloeibare honing", en: "Liquid honey", fr: "Miel liquide" }, query: { nl: "vloeibaar", en: "liquid", fr: "liquide" } },
  { key: "organic-honey", label: { nl: "Biologische honing", en: "Organic honey", fr: "Miel biologique" }, query: { nl: "biologische", en: "organic", fr: "biologique" } },
  { key: "comb-honey", label: { nl: "Raathoning", en: "Comb honey", fr: "Miel en rayon" }, query: { nl: "raathoning", en: "comb honey", fr: "miel en rayon" } },
  { key: "syrup", label: { nl: "Stroop & siroop", en: "Syrups", fr: "Sirops" }, query: { nl: "siroop", en: "syrup", fr: "sirop" } },
  { key: "all-honey", label: { nl: "Alle honing", en: "All honey", fr: "Tous les miels" } },
];

export const nutButterSubcategories: SearchSubcategory[] = [
  { key: "peanut", label: { nl: "Pindakaas", en: "Peanut butter", fr: "Beurre de cacahuète" }, query: { nl: "pindakaas", en: "peanut butter", fr: "beurre de cacahuète" } },
  { key: "almond", label: { nl: "Amandelpasta", en: "Almond butter", fr: "Beurre d’amande" }, query: { nl: "amandelpasta", en: "almond butter", fr: "beurre d’amande" } },
  { key: "hazelnut", label: { nl: "Hazelnootpasta", en: "Hazelnut butter", fr: "Beurre de noisette" }, query: { nl: "hazelnootpasta", en: "hazelnut butter", fr: "beurre de noisette" } },
  { key: "pistachio", label: { nl: "Pistachepasta", en: "Pistachio butter", fr: "Beurre de pistache" }, query: { nl: "pistachepasta", en: "pistachio butter", fr: "beurre de pistache" } },
  { key: "mixed-nut", label: { nl: "Gemengde notenpasta", en: "Mixed nut butter", fr: "Beurre de noix mélangées" }, query: { nl: "gemengde notenpasta", en: "mixed nut butter", fr: "beurre de noix mélangées" } },
  { key: "pecan", label: { nl: "Pecannotenpasta", en: "Pecan butter", fr: "Beurre de noix de pécan" }, query: { nl: "pecannotenpasta", en: "pecan butter", fr: "beurre de noix de pécan" } },
];

const SEARCH_SUBMENUS: Record<string, SearchSubcategory[]> = {
  "gedroogd-fruit": driedFruitSubcategories,
  honing: honeySubcategories,
  "notenpasta-s": nutButterSubcategories,
};

export type SubmenuItem = {
  key: string;
  name: string;
  href: string;
  /** Set for a child category; its products give the tile photo. */
  categoryId?: string;
  /** Set for a catalogue filter; the products matching it give the tile photo. */
  query?: string;
  /** The filter's search words in every language, since product names differ per language. */
  queries?: string[];
};

export function catalogSearchHref(locale: Locale, categorySlug: string, query: string): string {
  const params = new URLSearchParams({ f: categorySlug, q: query });
  return `${categoriesPath(locale)}?${params.toString()}#product-search`;
}

export function searchSubmenuItems(
  category: Pick<NavigationCategoryDto, "slug">,
  definitions: SearchSubcategory[],
  locale: Locale,
): SubmenuItem[] {
  return definitions.map((definition) => ({
    key: definition.key,
    name: definition.label[locale],
    query: definition.query?.[locale],
    queries: definition.query ? Object.values(definition.query) : undefined,
    href: definition.query ? catalogSearchHref(locale, category.slug, definition.query[locale]) : categoryPath(locale, category.slug),
  }));
}

/** The submenu items of a main category (by canonical slug), in menu order. */
export function categorySubmenu(
  categories: NavigationCategoryDto[],
  canonicalSlug: string,
  locale: Locale,
): { root: NavigationCategoryDto | undefined; items: SubmenuItem[] } {
  const root = findCategoryByCanonicalSlug(categories, canonicalSlug);
  if (!root) return { root, items: [] };
  const definitions = SEARCH_SUBMENUS[canonicalSlug];
  if (definitions) return { root, items: searchSubmenuItems(root, definitions, locale) };
  return {
    root,
    items: root.children.map((child) => ({ key: child.canonicalSlug, name: child.name, href: categoryPath(locale, child.slug), categoryId: child.id })),
  };
}
