import type { NextConfig } from "next";
import path from "node:path";
import { locales } from "./lib/i18n";
import { pageKeys, pageSlugs } from "./lib/pages";
import { categoriesSegment, pagesSegment, productsSegment } from "./lib/segments";
import { legacyWordpressRedirects } from "./lib/legacyRedirects";

const cdnBaseUrl = process.env.CDN_BASE_URL;
const cdnHostname = cdnBaseUrl ? new URL(cdnBaseUrl).hostname : undefined;
const imageHostnames = Array.from(
  new Set(["storage.googleapis.com", cdnHostname].filter((hostname): hostname is string => Boolean(hostname)))
);

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
  deploymentId: process.env.DEPLOYMENT_VERSION?.trim() || undefined,
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },
  images: {
    minimumCacheTTL: 2678400,
    qualities: [70, 75],
    remotePatterns: imageHostnames.map((hostname) => ({
      protocol: "https",
      hostname,
    })),
  },
  async headers() {
    return [
      {
        source: "/:locale(nl|en|fr)/:path*",
        missing: [{ type: "header", key: "rsc" }],
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate, s-maxage=60",
          },
        ],
      },
      ...["/admin/:path*", "/api/admin/:path*"].map((source) => ({
        source,
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, max-age=0, must-revalidate",
          },
        ],
      })),
    ];
  },
  async rewrites() {
    return [
      ...localizedPageRewrites(),
      ...localizedWildcardRewrites(categoriesSegment, "categories"),
      ...localizedIndexRewrites(categoriesSegment, "categories"),
    ];
  },
  async redirects() {
    return [
      { source: "/favicon.ico", destination: "/brand/favicon.png", permanent: true },
      ...legacyWordpressRedirects(),
      ...localizedPageRedirects(),
      ...localizedWildcardRedirects(productsSegment, "products"),
      ...localizedWildcardRedirects(categoriesSegment, "categories"),
      ...localizedIndexRedirects(categoriesSegment, "categories"),
    ];
  },
};

export default nextConfig;
