# Architecture Notes

## Dynamic route parameters are validated, not assumed

Every `page.tsx` and `layout.tsx` under `app/[locale]/` receives `params`
typed the way Next.js generates it: `locale` arrives as a plain `string`,
because the filesystem route segment matches any string. The route
handlers do not narrow that to the `Locale` union in the function
signature. Instead, each handler reads `params`, then calls `isLocale`
from `lib/i18n.ts` immediately: on a false result it calls `notFound()`
(or, in `generateMetadata`, returns an empty metadata object) before any
other code runs. After that check, TypeScript narrows the value to
`Locale` for the rest of the function, so the rest of each route body
stays fully typed against `Locale` without casts.

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

## Main category navigation ordering

`getMainCategories` in `lib/queries.ts` returns every active category for
header navigation, ordered by the `sortOrder` field on `Category` ascending,
with the `PROMOTIONAL` category (`acties`) always appended last regardless
of its own `sortOrder` value. The seed data assigns `acties` a `sortOrder`
of `0`, which would otherwise sort it first; the query separates standard
and promotional categories before concatenating them so the promotional
entry's position in the list is independent of its sort value.

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

## Styling: Tailwind v4 with a single token source

All design tokens — the five brand colors, derived border/muted/hover
tones, font family variables, and heading letter-spacing/weight — are
defined once, in the `@theme` block in `app/globals.css`. No component
defines a hex color, a color-carrying inline style, or a font outside
that block; everything consumes the resulting Tailwind utility classes
(`bg-background`, `text-accent`, `font-heading`, etc.).

The accent color (`#E0B200`) is restricted to fills, buttons, underlines,
and highlights. It is never used as text color on the light background,
because the contrast ratio between the accent yellow and the background
color fails accessibility guidelines for body text; text placed on an
accent-colored surface uses `#333333` (the base text color) or the
contrast black, both of which meet contrast requirements against yellow.

Heading typography (Dosis) and body typography (Montserrat) load once, as
variable fonts, in `app/[locale]/layout.tsx` via `next/font/google`,
exposed as CSS variables consumed by the `--font-heading`/`--font-body`
theme tokens. No page or component loads a font individually.

## Price and date formatting via Intl

`lib/format.ts` formats prices and dates using the platform `Intl` API
(`Intl.NumberFormat`, `Intl.DateTimeFormat`) rather than a date or
currency library. `Intl.DateTimeFormat` already covers every locale-aware
formatting need this project has (long-form dates in `nl`/`en`/`fr`), so a
dependency like `date-fns` would duplicate functionality the JavaScript
runtime already provides at zero bundle cost. `formatPrice` takes an
amount in whole cents — matching the `basePriceCents`/`priceCents`
integer fields in the Prisma schema — and formats it as EUR currency via
`Intl.NumberFormat`, avoiding floating-point cent/euro conversion bugs
anywhere outside this one function.

## Single source of truth for cross-locale URLs

`lib/alternates.ts` is the only place a cross-locale URL is constructed.
`getAlternates(locale, kind)` is wrapped in React's `cache()` so a single
request computes it once even when both a route's `generateMetadata` and
its page component call it. Fixed routes and content pages resolve their
language map from `lib/segments.ts` and `lib/pages.ts` directly, with no
database lookup, because every locale is guaranteed to have those routes.
Category and product routes look up `slugsByLocale` through the existing
`getCategory`/`getProductBySlug` queries. If a locale has no translation,
that locale is omitted from the `languages` map rather than guessing a URL.

Article routes are a partial exception: `getArticleBySlug` does not
currently return the article's slug in every other locale, so
`getAlternates` for an article returns only the requesting locale's own
canonical URL in `languages`. Extending `ArticleDetailDto` with a
`slugsByLocale` field, matching the product/category DTOs, would remove
this limitation.

`app/[locale]/layout.tsx` and every route with translated content
(`categories/[category]`, `products/[product]`, `pages/[slug]`,
`blogs/articles/[slug]`) call `getAlternates` for both their
`generateMetadata` hreflang output and the `LocaleSwitcher` prop, so there
is exactly one mechanism for cross-locale links, never two.
