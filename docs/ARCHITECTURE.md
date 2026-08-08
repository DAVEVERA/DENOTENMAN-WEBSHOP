# Architecture Notes

## Build-time static params without a database

`generateStaticParams` for the product and category detail routes reads
the set of known slugs from the database, through `getProductSlugs` and
`getCategorySlugs` in `lib/queries.ts`. Before Cloud SQL exists (see
`docs/CLOUD_SETUP.md`), or whenever the database is unreachable at build
time, these two functions catch any Prisma error internally and return
an empty array instead of throwing.

An empty array means `generateStaticParams` produces no static pages for
that locale, so the build completes successfully instead of failing.
Product and category pages then fall back to on-demand rendering once a
database connection is available, rather than blocking every build on
infrastructure that may not exist yet.

This fallback is intentionally silent at the type level: callers of
`getProductSlugs` and `getCategorySlugs` cannot distinguish "no products
exist" from "the database was unreachable." Both are treated the same
way, because either case should degrade to an empty static param set
rather than a failed build.
