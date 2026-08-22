import "server-only";

import { cache } from "react";
import { defaultLocale, type Locale } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { resolveProductDisplayPrice } from "@/lib/product-price";
import { product as productPath } from "@/lib/routes";
import {
  HOME_SLIDER_DEFINITIONS,
  resolveHomeSliderProducts,
  type HomeSliderProductDto,
  type HomeSliderVariantDto,
  type OfferedHomeSliderProduct,
} from "@/lib/home-product-slider";

const HOME_SLIDER_SKUS = HOME_SLIDER_DEFINITIONS.map((item) => item.sku);

function cleanSummary(value: string | null): string | null {
  const summary = value
    ?.replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!summary) return null;
  return summary.length > 180 ? `${summary.slice(0, 177).trimEnd()}…` : summary;
}

export const getHomeSliderProducts = cache(
  async (locale: Locale): Promise<HomeSliderProductDto[]> => {
    const translationLocales = locale === defaultLocale ? [locale] : [locale, defaultLocale];
    const unlimitedStock = process.env.UNLIMITED_STOCK === "true";
    const records = await prisma.product.findMany({
      where: {
        sku: { in: HOME_SLIDER_SKUS },
        isActive: true,
        variants: { some: { isActive: true } },
        translations: { some: { locale: { in: translationLocales } } },
      },
      select: {
        id: true,
        sku: true,
        basePriceCents: true,
        salePriceCents: true,
        translations: {
          where: { locale: { in: translationLocales } },
          select: {
            locale: true,
            slug: true,
            name: true,
            shortDescription: true,
            description: true,
          },
        },
        variants: {
          where: { isActive: true },
          orderBy: [{ weightGrams: "asc" }, { sku: "asc" }],
          select: {
            id: true,
            sku: true,
            priceCents: true,
            salePriceCents: true,
            stock: true,
            weightGrams: true,
            translations: {
              where: { locale: { in: translationLocales } },
              select: { locale: true, label: true },
            },
          },
        },
        productCategories: {
          where: { category: { isActive: true } },
          orderBy: [
            { isPrimary: "desc" },
            { sortOrder: "asc" },
            { category: { sortOrder: "asc" } },
          ],
          take: 1,
          select: {
            category: {
              select: {
                translations: {
                  where: { locale: { in: translationLocales } },
                  select: { locale: true, name: true },
                },
              },
            },
          },
        },
      },
    });

    const offeredProducts = records.flatMap((record): OfferedHomeSliderProduct[] => {
      const translation =
        record.translations.find((item) => item.locale === locale) ??
        record.translations.find((item) => item.locale === defaultLocale);

      if (!translation) return [];

      const variants: HomeSliderVariantDto[] = record.variants.map((variant) => {
        const variantTranslation =
          variant.translations.find((item) => item.locale === locale) ??
          variant.translations.find((item) => item.locale === defaultLocale);

        return {
          id: variant.id,
          sku: variant.sku,
          label: variantTranslation?.label ?? null,
          weightGrams: variant.weightGrams,
          priceCents: variant.salePriceCents ?? variant.priceCents,
          stock: unlimitedStock ? 999 : variant.stock,
        };
      });
      const defaultVariant =
        variants.find((variant) => variant.stock > 0) ?? variants[0] ?? null;
      const displayPrice = resolveProductDisplayPrice(
        record.basePriceCents,
        record.salePriceCents,
        record.variants.map((variant) => ({
          priceCents: variant.salePriceCents ?? variant.priceCents,
          regularPriceCents: variant.priceCents,
          salePriceCents: variant.salePriceCents,
        })),
      );
      const categoryTranslations =
        record.productCategories[0]?.category.translations ?? [];
      const categoryTranslation =
        categoryTranslations.find((item) => item.locale === locale) ??
        categoryTranslations.find((item) => item.locale === defaultLocale);

      return [
        {
          id: record.id,
          sku: record.sku,
          slug: translation.slug,
          href: productPath(locale, translation.slug),
          name: translation.name,
          shortDescription: cleanSummary(
            translation.shortDescription ?? translation.description,
          ),
          categoryName: categoryTranslation?.name ?? null,
          priceCents: displayPrice.priceCents,
          regularPriceCents: displayPrice.regularPriceCents,
          salePriceCents: displayPrice.salePriceCents,
          hasVariablePrice: displayPrice.hasVariablePrice,
          defaultVariant,
        },
      ];
    });

    return resolveHomeSliderProducts(offeredProducts);
  },
);
