import type { NextConfig } from "next";
import path from "node:path";
import { locales } from "./lib/i18n";
import { pageKeys, pageSlugs } from "./lib/pages";
import { categoriesSegment, pagesSegment, productsSegment } from "./lib/segments";
import { legacyWordpressRedirects } from "./lib/legacyRedirects";

const cdnBaseUrl = process.env.CDN_BASE_URL;
const cdnHostname = cdnBaseUrl ? new URL(cdnBaseUrl).hostname : undefined;

function localizedPageRewrites() {
  return locales.flatMap((locale) =>
    pageKeys.map((key) => ({
      source: `/${locale}/${pagesSegment[locale]}/${pageSlugs[key][locale]}`,
      destination: `/${locale}/pages/${pageSlugs[key][locale]}`,
    }))
  );
}

function localizedPageRedirects() {
  return locales.flatMap((locale) =>
    pageKeys
      .filter((key) => pagesSegment[locale] !== "pages")
      .map((key) => ({
        source: `/${locale}/pages/${pageSlugs[key][locale]}`,
        destination: `/${locale}/${pagesSegment[locale]}/${pageSlugs[key][locale]}`,
        permanent: true,
      }))
  );
}

function localizedWildcardRewrites(
  segment: Record<string, string>,
  physicalSegment: string
) {
  return locales
    .filter((locale) => segment[locale] !== physicalSegment)
    .map((locale) => ({
      source: `/${locale}/${segment[locale]}/:slug`,
      destination: `/${locale}/${physicalSegment}/:slug`,
    }));
}

function localizedWildcardRedirects(
  segment: Record<string, string>,
  physicalSegment: string
) {
  return locales
    .filter((locale) => segment[locale] !== physicalSegment)
    .map((locale) => ({
      source: `/${locale}/${physicalSegment}/:slug`,
      destination: `/${locale}/${segment[locale]}/:slug`,
      permanent: true,
    }));
}

// Same idea as the wildcard variants above, but for the bare index page
// itself (e.g. "all categories"), which has no :slug to match on.
function localizedIndexRewrites(segment: Record<string, string>, physicalSegment: string) {
  return locales
    .filter((locale) => segment[locale] !== physicalSegment)
    .map((locale) => ({
      source: `/${locale}/${segment[locale]}`,
      destination: `/${locale}/${physicalSegment}`,
    }));
}

function localizedIndexRedirects(segment: Record<string, string>, physicalSegment: string) {
  return locales
    .filter((locale) => segment[locale] !== physicalSegment)
    .map((locale) => ({
      source: `/${locale}/${physicalSegment}`,
      destination: `/${locale}/${segment[locale]}`,
      permanent: true,
    }));
}

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },
  images: {
    remotePatterns: cdnHostname
      ? [
          {
            protocol: "https",
            hostname: cdnHostname,
          },
        ]
      : [],
  },
  async rewrites() {
    return [
      ...localizedPageRewrites(),
      ...localizedWildcardRewrites(productsSegment, "products"),
      ...localizedWildcardRewrites(categoriesSegment, "categories"),
      ...localizedIndexRewrites(categoriesSegment, "categories"),
    ];
  },
  async redirects() {
    return [
      ...legacyWordpressRedirects(),
      ...localizedPageRedirects(),
      ...localizedWildcardRedirects(productsSegment, "products"),
      ...localizedWildcardRedirects(categoriesSegment, "categories"),
      ...localizedIndexRedirects(categoriesSegment, "categories"),
    ];
  },
};

export default nextConfig;
