import { locales } from "@/lib/i18n";
import { indexablePageKeys, pageSlugs } from "@/lib/pages";
import {
  getArticleSlugs,
  getCategorySlugs,
  getPageBySlug,
  getProductSlugs,
} from "@/lib/queries";
import { BASE_URL } from "@/lib/routes";
import { buildSitemapIndexXml, type SitemapIndexEntry } from "@/lib/sitemap-index";
import { latestMeaningfulDate } from "@/lib/sitemap";

export const dynamic = "force-dynamic";

const baseUrl = BASE_URL.replace(/\/+$/, "");

export async function GET(): Promise<Response> {
  const [products, categories, articles, contentPages] = await Promise.all([
    Promise.all(locales.map((locale) => getProductSlugs(locale))),
    Promise.all(locales.map((locale) => getCategorySlugs(locale))),
    Promise.all(locales.map((locale) => getArticleSlugs(locale))),
    Promise.all(
      indexablePageKeys.flatMap((key) =>
        locales.map((locale) =>
          getPageBySlug(pageSlugs[key][locale], locale).catch(() => null)
        )
      )
    ),
  ]);

  const productLastModified = latestMeaningfulDate(
    products.flat().map((entry) => entry.updatedAt)
  );
  const categoryLastModified = latestMeaningfulDate(
    [...categories.flat(), ...products.flat()].map((entry) => entry.updatedAt)
  );
  const articleLastModified = latestMeaningfulDate(
    articles.flat().map((entry) => entry.updatedAt)
  );
  const pageLastModified = latestMeaningfulDate([
    ...contentPages.map((page) => page?.updatedAt),
    productLastModified,
    categoryLastModified,
  ]);

  const entries: SitemapIndexEntry[] = [
    {
      url: `${baseUrl}/pages/sitemap.xml`,
      ...(pageLastModified ? { lastModified: pageLastModified } : {}),
    },
    {
      url: `${baseUrl}/products/sitemap.xml`,
      ...(productLastModified ? { lastModified: productLastModified } : {}),
    },
    {
      url: `${baseUrl}/categories/sitemap.xml`,
      ...(categoryLastModified ? { lastModified: categoryLastModified } : {}),
    },
    ...(articleLastModified
      ? [{
          url: `${baseUrl}/blog/sitemap.xml`,
          lastModified: articleLastModified,
        }]
      : []),
  ];

  return new Response(buildSitemapIndexXml(entries), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
