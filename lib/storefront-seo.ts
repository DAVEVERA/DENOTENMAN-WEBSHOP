import type { Metadata } from "next";
import type { AlternatesResult } from "@/lib/alternates";

export function buildStorefrontMetadata({
  title,
  description,
  alternates,
  noIndex = false,
}: {
  title: string;
  description: string;
  alternates?: AlternatesResult;
  noIndex?: boolean;
}): Metadata {
  return {
    title,
    description,
    ...(noIndex ? { robots: { index: false, follow: true } } : {}),
    ...(alternates
      ? { alternates: { canonical: alternates.canonical, languages: alternates.languages } }
      : {}),
  };
}

export function resolvePromotionalCategorySlug(
  categories: Array<{ slug: string; type: string }>
): string | undefined {
  return categories.find((category) => category.type === "PROMOTIONAL")?.slug;
}
