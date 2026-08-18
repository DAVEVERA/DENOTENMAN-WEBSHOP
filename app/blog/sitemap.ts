import type { MetadataRoute } from "next";
import { locales, type Locale } from "@/lib/i18n";
import { BASE_URL, article, articles } from "@/lib/routes";
import { getArticleSlugs } from "@/lib/queries";
import { latestMeaningfulDate, localizedSitemapEntries } from "@/lib/sitemap";

function absoluteUrl(path: string): string {
  return `${BASE_URL.replace(/\/+$/, "")}${path}`;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const byLocale = await Promise.all(
    locales.map(async (locale) => ({
      locale,
      entries: await getArticleSlugs(locale),
    }))
  );
  const indexLastModified = latestMeaningfulDate(
    byLocale.flatMap(({ entries }) => entries).map((entry) => entry.updatedAt)
  );
  const indexPaths = Object.fromEntries(
    locales.map((locale) => [locale, articles(locale)])
  ) as Record<Locale, string>;
  const indexLanguages: Record<string, string> = Object.fromEntries(
    Object.entries(indexPaths).map(([locale, path]) => [locale, absoluteUrl(path)])
  );
  indexLanguages["x-default"] = absoluteUrl(indexPaths.nl);

  return [
    ...(indexLastModified ? locales.map((locale) => ({
      url: absoluteUrl(articles(locale)),
      lastModified: indexLastModified,
      alternates: { languages: indexLanguages },
    })) : []),
    ...localizedSitemapEntries({ baseUrl: BASE_URL, byLocale, pathFor: article }),
  ];
}
