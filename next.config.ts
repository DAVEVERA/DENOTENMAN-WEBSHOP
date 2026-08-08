import type { NextConfig } from "next";
import { locales } from "@/lib/i18n";
import { pageKeys, pageSlugs } from "@/lib/pages";
import { categoriesSegment, pagesSegment, productsSegment } from "@/lib/segments";

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

const nextConfig: NextConfig = {
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
    ];
  },
  async redirects() {
    return [
      ...localizedPageRedirects(),
      ...localizedWildcardRedirects(productsSegment, "products"),
      ...localizedWildcardRedirects(categoriesSegment, "categories"),
    ];
  },
};

export default nextConfig;
