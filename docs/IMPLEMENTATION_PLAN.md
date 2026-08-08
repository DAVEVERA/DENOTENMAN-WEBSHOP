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
   DATABASE_URL, GCS_BUCKET, CDN_BASE_URL, SITE_URL, DEFAULT_LOCALE.
   CDN_BASE_URL is the image CDN host; SITE_URL is the storefront's own
   public domain, used by lib/routes.ts BASE_URL for canonical links,
   hreflang, the sitemap, and robots.txt. The two must never be the same
   value.
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
   getFilteredProducts(categorySlug, locale, filters, paging),
   getPageBySlug(slug, locale), getArticles(locale, paging),
   getArticleBySlug(slug, locale), getOrdersForUser(userId).
   getProductBySlug and getCategory resolve their record through the
   translated slug in ProductTranslation and CategoryTranslation, via a
   unique lookup on (locale, slug), never on the internal slug. A missing
   translation for the requested locale falls back to defaultLocale from
   lib/i18n.ts; if that is also missing, the record is treated as not
   found. This rule lives in one shared helper and is reused by every
   query. Return flat, locale-resolved DTOs (never raw Prisma models),
   with ProductImage.storageKey resolved to a public URL via
   publicImageUrl() from lib/storage.ts. getOrdersForUser is not
   locale-aware: orders and order items carry no translatable fields.
2. Filtering uses ProductAttribute key/value with AND semantics across
   multiple key/value pairs, and respects isActive. Supports paging with
   limit and offset, bounded by safe default and maximum values.
3. Static params for product and category detail routes read known slugs
   from the database. If the database is unreachable at build time (for
   example before Cloud SQL exists), the lookup returns an empty list
   instead of failing the build. See docs/ARCHITECTURE.md.

## Phase 7 — SEO surface
1. app/sitemap.ts: per-locale entries for home, the category index, every
   category, every product, every content page from lib/pages.ts, the
   blog index, and every article. Every URL uses the translated segments
   from lib/segments.ts and the translated slugs, matching what the
   redirects resolve to and what the user sees. cart, account, and admin
   are excluded. Each entry's alternates.languages lists the equivalent
   URL per locale, matching the hreflang set in the page metadata.
   lastModified comes from updatedAt where available. Product, category,
   and article listings are pulled from getProductSlugs, getCategorySlugs,
   and getArticleSlugs in lib/queries.ts, not from the paginated,
   user-facing queries: those three functions are unpaginated, ordered
   deterministically, and degrade to an empty list instead of failing
   when the database is unreachable, so the sitemap always returns a
   valid (possibly smaller) response.
2. app/robots.ts: allow all, disallow /{locale}/cart, /{locale}/account,
   /{locale}/admin for every locale, and /api. Reference the sitemap URL
   built from BASE_URL in lib/routes.ts, which reads SITE_URL (the
   storefront's own domain, distinct from CDN_BASE_URL).

## Out of scope for code (manual, human-performed)
- Creating the GCP project, Cloud SQL instance, Storage bucket, IAM service
  accounts and Secret Manager entries. Document required roles in docs/,
  do not attempt to provision or store credentials in the repo.