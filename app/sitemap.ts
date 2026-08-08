import type { MetadataRoute } from "next";
import { locales, type Locale } from "@/lib/i18n";
import { BASE_URL, article, articles, category, categories, home, product } from "@/lib/routes";
import { pageKeys, pagePath, pageSlugs } from "@/lib/pages";
import {
  getArticleSlugs,
  getCategorySlugs,
  getPageBySlug,
  getProductSlugs,
  type SlugEntryDto,
} from "@/lib/queries";

type SitemapEntry = MetadataRoute.Sitemap[number];

function absoluteUrl(path: string): string {
  return `${BASE_URL}${path}`;
}

function languageAlternates(
  pathByLocale: Partial<Record<Locale, string>>
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(pathByLocale).map(([locale, path]) => [locale, absoluteUrl(path)])
  );
}

function homeEntries(): SitemapEntry[] {
  const pathByLocale = Object.fromEntries(
    locales.map((locale) => [locale, home(locale)])
  ) as Record<Locale, string>;

  return locales.map((locale) => ({
    url: absoluteUrl(home(locale)),
    changeFrequency: "daily" as const,
    priority: 1,
    alternates: { languages: languageAlternates(pathByLocale) },
  }));
}

function categoryIndexEntries(): SitemapEntry[] {
  const pathByLocale = Object.fromEntries(
    locales.map((locale) => [locale, categories(locale)])
  ) as Record<Locale, string>;

  return locales.map((locale) => ({
    url: absoluteUrl(categories(locale)),
    changeFrequency: "daily" as const,
    priority: 0.8,
    alternates: { languages: languageAlternates(pathByLocale) },
  }));
}

function articleIndexEntries(): SitemapEntry[] {
  const pathByLocale = Object.fromEntries(
    locales.map((locale) => [locale, articles(locale)])
  ) as Record<Locale, string>;

  return locales.map((locale) => ({
    url: absoluteUrl(articles(locale)),
    changeFrequency: "daily" as const,
    priority: 0.5,
    alternates: { languages: languageAlternates(pathByLocale) },
  }));
}

async function slugEntriesByLocale(
  getSlugs: (locale: Locale) => Promise<SlugEntryDto[]>
): Promise<{ locale: Locale; entries: SlugEntryDto[] }[]> {
  return Promise.all(
    locales.map(async (locale) => ({
      locale,
      entries: await getSlugs(locale),
    }))
  );
}

function toLocalizedSitemapEntries(
  byLocale: { locale: Locale; entries: SlugEntryDto[] }[],
  pathFor: (locale: Locale, slug: string) => string,
  changeFrequency: SitemapEntry["changeFrequency"],
  priority: number
): SitemapEntry[] {
  const pathById = new Map<string, Partial<Record<Locale, string>>>();

  for (const { locale, entries } of byLocale) {
    for (const entry of entries) {
      const existing = pathById.get(entry.id) ?? {};
      existing[locale] = pathFor(locale, entry.slug);
      pathById.set(entry.id, existing);
    }
  }

  return byLocale.flatMap(({ locale, entries }) =>
    entries.map((entry) => ({
      url: absoluteUrl(pathFor(locale, entry.slug)),
      lastModified: entry.updatedAt,
      changeFrequency,
      priority,
      alternates: { languages: languageAlternates(pathById.get(entry.id) ?? {}) },
    }))
  );
}

async function categoryEntries(): Promise<SitemapEntry[]> {
  const byLocale = await slugEntriesByLocale(getCategorySlugs);
  return toLocalizedSitemapEntries(byLocale, category, "weekly", 0.7);
}

async function productEntries(): Promise<SitemapEntry[]> {
  const byLocale = await slugEntriesByLocale(getProductSlugs);
  return toLocalizedSitemapEntries(byLocale, product, "weekly", 0.6);
}

async function articleEntries(): Promise<SitemapEntry[]> {
  const byLocale = await slugEntriesByLocale(getArticleSlugs);
  return toLocalizedSitemapEntries(byLocale, article, "monthly", 0.4);
}

async function pageEntries(): Promise<SitemapEntry[]> {
  try {
    const entries: SitemapEntry[] = [];

    for (const key of pageKeys) {
      const pathByLocale = Object.fromEntries(
        locales.map((locale) => [locale, pagePath(key, locale)])
      ) as Record<Locale, string>;

      let lastModified: Date | undefined;

      for (const locale of locales) {
        const page = await getPageBySlug(pageSlugs[key][locale], locale);

        if (page) {
          lastModified = page.updatedAt;
          break;
        }
      }

      for (const locale of locales) {
        entries.push({
          url: absoluteUrl(pagePath(key, locale)),
          lastModified,
          changeFrequency: "yearly" as const,
          priority: 0.3,
          alternates: { languages: languageAlternates(pathByLocale) },
        });
      }
    }

    return entries;
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categoryList, productList, pageList, articleList] = await Promise.all([
    categoryEntries(),
    productEntries(),
    pageEntries(),
    articleEntries(),
  ]);

  return [
    ...homeEntries(),
    ...categoryIndexEntries(),
    ...categoryList,
    ...productList,
    ...pageList,
    ...articleIndexEntries(),
    ...articleList,
  ];
}
