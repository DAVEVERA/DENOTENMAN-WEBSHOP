import type { Locale } from "@/lib/i18n";
import { toProductPlainText } from "@/lib/product-content";

type ProductDescriptionSource = {
  name: string;
  descriptionHtml: string | null;
  description: string | null;
  shortDescription: string | null;
  category?: { name: string } | null;
};

const categoryFallbacks: Record<Locale, (name: string, category?: string) => string> = {
  nl: (name, category) =>
    `${name} van De Notenman${category ? ` uit de categorie ${category}` : ""}.`,
  en: (name, category) =>
    `${name} from De Notenman${category ? ` in the ${category} category` : ""}.`,
  fr: (name, category) =>
    `${name} de De Notenman${category ? ` dans la catégorie ${category}` : ""}.`,
};

const variantSuffixes: Record<Locale, (label: string) => string> = {
  nl: (label) => `Verpakking: ${label}.`,
  en: (label) => `Pack size: ${label}.`,
  fr: (label) => `Format : ${label}.`,
};

export function resolveProductDescription(
  product: ProductDescriptionSource,
  locale: Locale
): string {
  const suppliedDescription = [
    product.descriptionHtml,
    product.description,
    product.shortDescription,
  ]
    .map(toProductPlainText)
    .find(Boolean);

  return (
    suppliedDescription || categoryFallbacks[locale](product.name, product.category?.name)
  );
}

export function resolveProductVariantDescription(
  product: ProductDescriptionSource,
  locale: Locale,
  label: string
): string {
  return `${resolveProductDescription(product, locale)} ${variantSuffixes[locale](label)}`;
}
