# Implementation Plan

Build a multilingual (nl/en/fr) e-commerce storefront with Next.js
(App Router, TypeScript), Prisma + PostgreSQL (Cloud SQL), and Google
Cloud Storage for images. Follow docs/STRUCTURE.md for all placement.

## Ground rules
- Prices are stored as integer cents. Never use floats for money.
- The database stores storage keys for images, never full URLs.
- Translatable text lives in *Translation tables, never on the base row.
- Every code file contains only code. All prose stays in docs/.

## Phase 1 — Project bootstrap
1. Fill package.json with deps: next, react, react-dom, typescript,
   @prisma/client, prisma, @google-cloud/storage, zod.
   Dev deps: @types/node, @types/react, tsx.
2. Fill tsconfig.json with strict mode and a "@/*" path alias to root.
3. Fill next.config.ts (project root): enable image remotePatterns for the
   CDN host.
4. Fill .env.example with keys only (no values):
   DATABASE_URL, GCS_BUCKET, CDN_BASE_URL, DEFAULT_LOCALE.
5. Fill .gitignore for node, next, env, prisma.

## Phase 2 — Internationalization
1. lib/i18n.ts: export locales ["nl","en","fr"], defaultLocale "nl", Locale type.
2. middleware.ts: detect locale from path/Accept-Language, redirect "/" to
   the matched locale. Matcher excludes api, _next and static files.
3. dictionaries/{nl,en,fr}.json: UI string maps with identical key sets.
4. app/[locale]/layout.tsx: load the dictionary for the active locale,
   render header/footer, set html lang. Add hreflang alternates in metadata.

## Phase 3 — Routing skeleton
1. lib/segments.ts: the single source for every translated route segment
   (pagesSegment, productsSegment, categoriesSegment), keyed by locale.
2. lib/routes.ts: BASE_URL and typed URL builders (home, category,
   categories, product, articles, article, cart, account) that all
   include the locale and read their translated segment from
   lib/segments.ts. Content-page URLs are owned by lib/pages.ts
   (pagePath, resolvePageKey), which also reads pagesSegment from
   lib/segments.ts.
3. The physical route for categories is app/[locale]/categories/[category],
   matching the Category model. next.config.ts generates wildcard rewrites
   (translated segment -> physical segment) and permanent redirects
   (physical segment -> translated segment) for products and categories
   from lib/segments.ts, only where the translated and physical segment
   differ. The same pattern applies to content pages, generated from the
   fixed key list in lib/pages.ts.
4. Implement each page.tsx as a server component that reads params
   (locale + slug) and calls the data layer. Add generateStaticParams
   where the set is known (categories, locales).

## Phase 4 — Data layer (Prisma)
1. prisma/schema.prisma: models Category, CategoryTranslation, Product,
   ProductTranslation, ProductCategory (m:n), ProductVariant, ProductImage,
   ProductAttribute. Locale enum. Prices as Int cents.
2. lib/prisma.ts: singleton PrismaClient (guarded for dev hot-reload).
3. prisma/seed.ts: seed the five categories (puffs, chips, pops, protein, all)
   with nl/en/fr names, plus the product set with translations and image keys.

## Phase 5 — Storage
1. lib/storage.ts: publicImageUrl(key) via CDN_BASE_URL; createUploadUrl(key,
   contentType) returning a v4 signed write URL valid 10 minutes.
2. Never expose bucket write access to the client except via signed URLs.

## Phase 6 — Queries and filtering
1. lib/queries.ts: getProductBySlug(slug, locale), getCategory(slug, locale),
   getFilteredProducts(categorySlug, locale, filters[]), getPageBySlug(slug,
   locale), getArticles(locale), getArticleBySlug(slug, locale),
   getOrdersForUser(userId, locale). getCategory resolves the Category by
   its (locale, slug) pair, matching CategoryTranslation. Return flat,
   locale-resolved objects with CDN image URLs. Every query is locale-aware.
2. Filtering uses ProductAttribute key/value with AND semantics.

## Phase 7 — SEO surface
1. app/sitemap.ts: static + per-locale entries for categories, products,
   pages, articles, pulled from the data layer.
2. app/robots.ts: allow all, disallow /cart /account /api, reference sitemap.

## Out of scope for code (manual, human-performed)
- Creating the GCP project, Cloud SQL instance, Storage bucket, IAM service
  accounts and Secret Manager entries. Document required roles in docs/,
  do not attempt to provision or store credentials in the repo.