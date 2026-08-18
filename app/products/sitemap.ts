import type { MetadataRoute } from "next";
import { locales } from "@/lib/i18n";
import { BASE_URL, product } from "@/lib/routes";
import { getProductSitemapSlugs } from "@/lib/queries";
import { localizedSitemapEntries } from "@/lib/sitemap";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const byLocale = await Promise.all(
    locales.map(async (locale) => ({
      locale,
      entries: await getProductSitemapSlugs(locale),
    }))
  );

  return localizedSitemapEntries({ baseUrl: BASE_URL, byLocale, pathFor: product });
}
