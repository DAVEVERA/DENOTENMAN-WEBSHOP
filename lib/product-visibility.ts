import { z } from "zod";
import { categories, category, home, product } from "@/lib/routes";
import { isLocale, locales } from "@/lib/i18n";

export const productVisibilityInputSchema = z
  .object({
    isActive: z.boolean(),
    version: z.string().datetime(),
  })
  .strict();

export type LocalizedSlug = {
  locale: string;
  slug: string;
};

export type ProductRevalidationInput = {
  productId: string;
  translations: LocalizedSlug[];
  categoryTranslations: LocalizedSlug[];
};

export function productRevalidationPaths({
  productId,
  translations,
  categoryTranslations,
}: ProductRevalidationInput): string[] {
  const paths = new Set<string>([
    "/admin",
    "/admin/producten",
    `/admin/producten/${productId}`,
    "/sitemap.xml",
  ]);

  for (const locale of locales) {
    paths.add(home(locale));
    paths.add(categories(locale));
  }
  for (const translation of translations) {
    if (isLocale(translation.locale)) paths.add(product(translation.locale, translation.slug));
  }
  for (const translation of categoryTranslations) {
    if (isLocale(translation.locale)) paths.add(category(translation.locale, translation.slug));
  }

  return [...paths];
}
