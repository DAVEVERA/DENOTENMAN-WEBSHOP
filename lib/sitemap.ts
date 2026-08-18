import type { MetadataRoute } from "next";
import { defaultLocale, type Locale } from "@/lib/i18n";

export type SitemapSlugEntry = {
  id: string;
  slug: string;
  updatedAt: Date;
  images?: string[];
};

type LocalizedEntriesInput = {
  baseUrl: string;
  byLocale: { locale: Locale; entries: SitemapSlugEntry[] }[];
  pathFor: (locale: Locale, slug: string) => string;
};

function absoluteUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}${path}`;
}

export function localizedSitemapEntries({
  baseUrl,
  byLocale,
  pathFor,
}: LocalizedEntriesInput): MetadataRoute.Sitemap {
  const pathsById = new Map<string, Partial<Record<Locale, string>>>();

  for (const { locale, entries } of byLocale) {
    for (const entry of entries) {
      const paths = pathsById.get(entry.id) ?? {};
      paths[locale] = absoluteUrl(baseUrl, pathFor(locale, entry.slug));
      pathsById.set(entry.id, paths);
    }
  }

  return byLocale.flatMap(({ locale, entries }) =>
    entries.map((entry) => {
      const localizedPaths = pathsById.get(entry.id) ?? {};
      const languages: Record<string, string> = Object.fromEntries(
        Object.entries(localizedPaths)
      );
      const fallback = localizedPaths[defaultLocale];
      if (fallback) languages["x-default"] = fallback;

      return {
        url: absoluteUrl(baseUrl, pathFor(locale, entry.slug)),
        lastModified: entry.updatedAt,
        ...(entry.images?.length ? { images: entry.images } : {}),
        alternates: { languages },
      };
    })
  );
}

export function latestMeaningfulDate(
  dates: readonly (Date | null | undefined)[]
): Date | undefined {
  return dates.reduce<Date | undefined>((latest, candidate) => {
    if (!candidate) return latest;
    return !latest || candidate.getTime() > latest.getTime() ? candidate : latest;
  }, undefined);
}
