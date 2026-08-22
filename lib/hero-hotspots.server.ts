import "server-only";

import { cache } from "react";
import type { Locale } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { product } from "@/lib/routes";
import {
  HERO_LABELS,
  resolveHeroProductHotspots,
  type HeroProductHotspot,
} from "@/lib/hero-hotspots";

const HERO_PRODUCT_SKUS = [...new Set(HERO_LABELS.map((label) => label.sku))];

export const getHeroProductHotspots = cache(
  async (locale: Locale): Promise<HeroProductHotspot[]> => {
    const products = await prisma.product.findMany({
      where: {
        sku: { in: HERO_PRODUCT_SKUS },
        isActive: true,
        variants: { some: { isActive: true } },
        translations: { some: { locale } },
      },
      select: {
        sku: true,
        translations: {
          where: { locale },
          select: { name: true, slug: true },
          take: 1,
        },
      },
    });

    return resolveHeroProductHotspots(
      products.flatMap((item) => {
        const translation = item.translations[0];
        return translation
          ? [{ sku: item.sku, name: translation.name, slug: translation.slug }]
          : [];
      }),
      (slug) => product(locale, slug),
    );
  },
);
