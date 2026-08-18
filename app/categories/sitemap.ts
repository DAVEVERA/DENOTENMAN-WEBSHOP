import type { MetadataRoute } from "next";
import { locales, type Locale } from "@/lib/i18n";
import { BASE_URL, categories, category } from "@/lib/routes";
import { getCategorySlugs, getProductSlugs } from "@/lib/queries";
import { latestMeaningfulDate, localizedSitemapEntries } from "@/lib/sitemap";

function absoluteUrl(path: string): string {
  return `${BASE_URL.replace(/\/+$/, "")}${path}`;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [byLocale, productEntries] = await Promise.all([
    Promise.all(
      locales.map(async (locale) => ({
        locale,
        entries: await getCategorySlugs(locale),
      }))
    ),
    Promise.all(locales.map((locale) => getProductSlugs(locale))),
  ]);
  const indexLastModified = latestMeaningfulDate(
    [...byLocale.flatMap(({ entries }) => entries), ...productEntries.flat()].map(
      (entry) => entry.updatedAt
    )
  );
  const indexPaths = Object.fromEntries(
    locales.map((locale) => [locale, categories(locale)])
  ) as Record<Locale, string>;
  const indexLanguages: Record<string, string> = Object.fromEntries(
    Object.entries(indexPaths).map(([locale, path]) => [locale, absoluteUrl(path)])
  );
  indexLanguages["x-default"] = absoluteUrl(indexPaths.nl);

  return [
    ...locales.map((locale) => ({
      url: absoluteUrl(categories(locale)),
      ...(indexLastModified ? { lastModified: indexLastModified } : {}),
      alternates: { languages: indexLanguages },
    })),
    ...localizedSitemapEntries({ baseUrl: BASE_URL, byLocale, pathFor: category }),
  ];
}
