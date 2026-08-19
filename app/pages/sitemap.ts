import type { MetadataRoute } from "next";
import { locales, type Locale } from "@/lib/i18n";
import { BASE_URL, home } from "@/lib/routes";
import { indexablePageKeys, pagePath, pageSlugs } from "@/lib/pages";
import { getCategorySlugs, getPageBySlug, getProductSlugs } from "@/lib/queries";
import { latestMeaningfulDate } from "@/lib/sitemap";

type SitemapEntry = MetadataRoute.Sitemap[number];

function absoluteUrl(path: string): string {
  return `${BASE_URL.replace(/\/+$/, "")}${path}`;
}

function languageAlternates(
  pathByLocale: Partial<Record<Locale, string>>
): Record<string, string> {
  const languages: Record<string, string> = Object.fromEntries(
    Object.entries(pathByLocale).map(([locale, path]) => [locale, absoluteUrl(path)])
  );
  if (pathByLocale.nl) languages["x-default"] = absoluteUrl(pathByLocale.nl);
  return languages;
}

async function homeEntries(): Promise<SitemapEntry[]> {
  const [products, categories] = await Promise.all([
    Promise.all(locales.map((locale) => getProductSlugs(locale))),
    Promise.all(locales.map((locale) => getCategorySlugs(locale))),
  ]);
  const lastModified = latestMeaningfulDate(
    [...products.flat(), ...categories.flat()].map((entry) => entry.updatedAt)
  );
  const pathByLocale = Object.fromEntries(
    locales.map((locale) => [locale, home(locale)])
  ) as Record<Locale, string>;

  return locales.map((locale) => ({
    url: absoluteUrl(home(locale)),
    ...(lastModified ? { lastModified } : {}),
    alternates: { languages: languageAlternates(pathByLocale) },
  }));
}

async function pageEntries(): Promise<SitemapEntry[]> {
  const entriesByKey = await Promise.all(
    indexablePageKeys.map(async (key) => {
      const pathByLocale = Object.fromEntries(
        locales.map((locale) => [locale, pagePath(key, locale)])
      ) as Record<Locale, string>;
      const pages = await Promise.all(
        locales.map((locale) =>
          getPageBySlug(pageSlugs[key][locale], locale).catch(() => null)
        )
      );
      const lastModified = latestMeaningfulDate(pages.map((page) => page?.updatedAt));

      return locales.map((locale) => ({
        url: absoluteUrl(pagePath(key, locale)),
        ...(lastModified ? { lastModified } : {}),
        alternates: { languages: languageAlternates(pathByLocale) },
      }));
    })
  );

  return entriesByKey.flat();
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [homes, pages] = await Promise.all([homeEntries(), pageEntries()]);
  return [...homes, ...pages];
}
