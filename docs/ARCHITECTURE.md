# Architecture Notes

## Build-time static params without a database

`generateStaticParams` for the product and category detail routes, and
`app/sitemap.ts`, all read their set of known slugs from the database
through `getProductSlugs`, `getCategorySlugs`, and `getArticleSlugs` in
`lib/queries.ts`. Before Cloud SQL exists (see `docs/CLOUD_SETUP.md`), or
whenever the database is unreachable at build or request time, these
three functions catch any Prisma error internally and return an empty
array instead of throwing.

An empty array means `generateStaticParams` produces no static pages for
that locale, so the build completes successfully instead of failing.
Product and category pages then fall back to on-demand rendering once a
database connection is available, rather than blocking every build on
infrastructure that may not exist yet. For the same reason, the sitemap
degrades to a smaller, valid sitemap containing only the entries that do
not depend on the database (home, category index, blog index) rather
than failing to render.

This fallback is intentionally silent at the type level: callers of
`getProductSlugs`, `getCategorySlugs`, and `getArticleSlugs` cannot
distinguish "no records exist" from "the database was unreachable." Both
are treated the same way, because either case should degrade to an empty
result set rather than a failed build or a failed sitemap request.

## Sitemap size

`app/sitemap.ts` is a single sitemap file, built from `getProductSlugs`,
`getCategorySlugs`, `getArticleSlugs`, and the fixed content-page list in
`lib/pages.ts`. A single sitemap file has a hard ceiling of 50,000 URLs
and 50MB uncompressed, per the sitemap protocol that search engines
enforce. Once the combined count of products, categories, and articles
across all locales approaches that ceiling, switch to Next.js's
`generateSitemaps`, splitting into one sub-sitemap per content type
(products, categories, articles) so each stays well under the limit
instead of growing a single file toward it.
