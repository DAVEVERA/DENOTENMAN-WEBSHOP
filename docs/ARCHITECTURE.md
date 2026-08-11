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

## Why locale-switcher alternates are computed per route layout, not in the root layout

React Server Components cannot pass data from a child route segment up
into a shared ancestor layout at request time. A layout receives only its
own segment's `params` — `app/[locale]/layout.tsx` never sees `params.product`
or `params.category` from a nested dynamic route, and there is no context
or pathname API that lets a leaf page inform an ancestor layout what route
is actually being rendered. This means a single shared root layout cannot
correctly compute the target-language URL for the LocaleSwitcher on every
page: it would have to guess, and guessing produced a real bug where every
non-home page's language switcher linked to the target locale's homepage
instead of the translated equivalent of the current page.

The fix follows Next.js's own support for layouts at every route segment.
`app/[locale]/layout.tsx` now contains only the document shell (html, body,
fonts, skip-link, globals.css import) and renders no header or footer.
Every standalone route under `app/[locale]/` — cart, account, the
category detail route, the product detail route, content pages, and the
article detail route — has its own thin `layout.tsx` that reads its own
route params, computes the correct `AlternateKind` for `getAlternates`,
and renders `SiteShell` (the single place `Header` and `Footer` are
composed) with the resulting `languages` map. Three routes are the
exception and render `SiteShell` directly in their own page component
instead of via a separate `layout.tsx`: the home route, and the
categories and articles list pages (see below for why the list pages
need this exception too).

`getAlternates` is wrapped in React's `cache()` (see the single-source-of-truth
section above), so each of these new layout-level calls is deduplicated
against the same route's `generateMetadata` call within the same request —
no route pays for a second database lookup because of this restructuring.

Where a route has both a list and a detail segment (categories, articles),
only the detail segment's dynamic route gets its own `layout.tsx` — the
list page renders `SiteShell` directly in its own page component, exactly
like the home page, because a shared `layout.tsx` at the parent level
would wrap both the list AND the detail route, and the detail route
already gets its own more specific `SiteShell` render, which would double
the header and footer if the parent also rendered one.

## Logo component API

`components/ui/Logo.tsx` is the only file that references a path inside
`public/brand/`. Every caller goes through two independent props:
`variant` (`"light" | "dark"`, default `"light"`) selects which wordmark
asset to render for the background it sits on; `parts`
(`"mark" | "wordmark" | "full"`, default `"full"`) selects which pieces of
the logo to render. `Header` renders `variant="light" parts="full"` on the
light background band. `Footer` renders `variant="dark" parts="wordmark"`
on the light panel inside the dark contrast band, since only the wordmark
is shown there.

`variant="dark"` currently resolves to the same `logo-wordmark.svg` as
`variant="light"`, because no inverted export exists yet (see the
`public/brand/` placement rule in `docs/STRUCTURE.md`). Once
`logo-wordmark-inverted.svg` is added, only the `wordmarkSrc` map inside
`Logo.tsx` needs to change — no caller changes, since every consumer
already asks for `variant="dark"` where an inverted mark belongs.

## Icon convention

`lucide-react` is the only icon library used anywhere in this project. No
other icon set, no hand-drawn SVG icon, and no icon font are introduced.
Every icon is imported directly from `lucide-react` at its default stroke
width (`strokeWidth={2}`, the library default — never overridden per
instance) so every icon in the interface reads as part of one consistent
set. Icon sizes come from the token scale (`h-4 w-4`, `h-5 w-5`, `h-6 w-6`
— Tailwind's default spacing scale, matched to the icon's role: inline
with body text uses the smallest size, standalone interactive icons like
header actions use the middle size, larger decorative or featured icons
use the largest). Icons that are purely decorative — meaning the same
information is already conveyed by adjacent visible text — are hidden
from assistive technology with `aria-hidden="true"`. Icons that are the
only content of an interactive element (an icon-only button) instead
carry the accessible name on the parent control (`aria-label` on the
`<button>`), not on the icon itself.

## Product grid convention

Every product listing (`app/[locale]/page.tsx`, `app/[locale]/categories/page.tsx`,
`app/[locale]/categories/[category]/page.tsx`) uses the same responsive
grid: `grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4` — two columns
on phone, three on tablet, four on desktop. Any future page that lists
`ProductCard` instances uses this exact class string.

## Design system: tokens, components, and motion

All spacing, radius, shadow, text-size, and motion tokens added in this
phase live in the single `@theme` block in `app/globals.css`, alongside
the color and font tokens already established. Two named hover durations
exist site-wide — declared as `--transition-duration-hover` in
`app/globals.css` and consumed via the `duration-hover` Tailwind utility
(320ms, used for card lift/border transitions), and
`--transition-duration-hover-fast`/`duration-hover-fast` (240ms, used for
text/icon color and small positional shifts like the mega-menu chevron) —
matching the two distinct speeds specified by the design reference this
phase was built from, rather than collapsing them into one blended value.

`Button` has three variants (`primary`, `secondary`, `ghost`) and three
sizes (`sm`, `md`, `lg`), with hover, focus (via the global
`:focus-visible` rule), active, disabled, and busy states. `Card` is a
bare shape-and-hover primitive (4px lift, border color shift, soft
shadow) with no content opinion; `ProductCard` composes it. `FavoriteButton`
is a stateful toggle with a color-only (no motion) hover and active
treatment, using Tailwind's built-in `red-600` directly rather than a
brand palette token, since a favorite heart's red is a conventional
micro-interaction color independent of the five-color brand palette — this
is the one deliberate exception to "colors come from tokens only," and it
is scoped to this single component. `Tabs` follows the ARIA Authoring
Practices Guide tabs pattern (roving tabindex, arrow-key navigation,
`role="tablist"`/`"tab"`/`"tabpanel"`). `USPBar` renders three populated
points plus an optional fourth slot for shipping copy that is not yet
supplied by any caller.

Every animated/transform-based hover effect is disabled under
`prefers-reduced-motion: reduce` via one global rule in `app/globals.css`
that zeroes all animation and transition durations site-wide — individual
components do not each re-implement this query. Color and shadow changes
remain under reduced motion, since they are not zeroed by the duration
override (an instant color swap still communicates the hover/active state
without motion).

## Loading indicator: a deliberate exception to token-only styling

`components/ui/LoadingIndicator.tsx` and its sibling
`components/ui/LoadingIndicator.loader.css` are ported verbatim from a
pre-built, self-contained truck-and-cargo loading animation supplied
outside this project's normal design process. Every CSS value — colors,
timings, easing curves, geometry, keyframe percentages — is copied exactly
as originally authored and is not expressed as design tokens, and does
not flow through the `@theme` block. This is the one place in the
codebase where styling does not originate from a token. The exception
exists because the loader's visual identity must remain byte-for-byte
identical to the original demo; tokenizing it would risk subtly altering
values during the translation to `--variable` references. The CSS file is
imported only by `LoadingIndicator.tsx`, and every one of its class names
carries a `dn-` prefix not used anywhere else in the project, so none of
it leaks into or conflicts with any other component's styling. The
component is not yet wired into any page, transition, or data-loading
state — that placement decision is deferred to a later phase.

## Known gaps carried forward from this phase

- The mega-menu's per-category featured block reads
  `CategoryTranslation.description`, which today's seed data does not
  populate — the slot renders nothing until a category actually has a
  description. No fake content was invented to fill the visual space.
- The mega-menu does not render subcategories, because `getMainCategories`
  deliberately excludes non-top-level categories (see the "Main category
  navigation ordering" section above) and no subcategory query exists yet.
  The mega-menu's layout has room for a subcategory list per category once
  that query is built.
- The header's sticky-scroll divider is a permanent, CSS-only border plus
  backdrop blur, not a border that appears only after the user scrolls
  past the top of the page — implementing the latter requires converting
  `Header` (currently a server component that awaits `getMainCategories`)
  into, or wrapping it in, a client component that tracks scroll position.
- `LocaleSwitcher`'s locale-specific alternates on non-home routes were
  already fixed in Phase 8b; this phase only restyled its spacing.
- `--color-muted` (`#7A7367`) on `--color-background` (`#F6F3EE`) computes
  to approximately 4.24:1 contrast, which clears the 3:1 WCAG AA threshold
  for large text and UI components but falls short of the 4.5:1 threshold
  for normal/small body text. This phase newly applies that pairing at
  small text size (`text-body-sm`) in two places: `ProductCard`'s category
  label and `MegaMenu`'s category description. The token itself is a
  pre-existing brand-palette decision from an earlier phase and is not
  altered here; this is flagged as a known, unresolved gap for a future
  accessibility pass to address (for example by darkening the token
  slightly, or reserving `text-muted` for large-text/UI-only contexts
  going forward), not fixed in this phase.

## The spreadsheet as catalog source of truth, imported one-way

The product catalog originates in a spreadsheet maintained by the site
owner, not in `prisma/schema.prisma` seed literals. `prisma/seed.ts` reads
that spreadsheet through the Google Sheets API and writes the result into
the database; there is no path in the other direction. Nothing in the
application reads the spreadsheet at request time, and no runtime code
writes back to it. This keeps catalog authoring in a tool the site owner
already knows, while the storefront itself only ever depends on the
database, exactly like every other content type in this project.

The source must be a native spreadsheet in the operator's account, not an
uploaded Office file: the Sheets API cannot read the contents of an
uploaded `.xlsx` file, only a spreadsheet actually created in or converted
to the native format. This is a one-time authoring constraint on the
source file, not something the import script can work around.

## Google Cloud Translation as an import-time step, not a runtime dependency

Dutch is the spreadsheet's only language. `prisma/seed.ts` calls the
Google Cloud Translation API to produce the English and French text
stored in the database, once, at import time. The storefront never calls
the Translation API while serving a request; every locale's copy already
exists as a `ProductTranslation` row (or a locale-suffixed
`ProductAttribute`, see below) by the time a page renders. This keeps
translation cost and latency out of the request path entirely and means a
translation outage never degrades the storefront.

Translation calls are batched per product rather than issued per field.
A product has multiple translatable fields (name, description, and any
localized attributes); requesting all of them in one call per product per
target language keeps the total call volume proportional to the catalog
size rather than to the catalog size times the field count.

## `isActive: false` as the sole exclusion mechanism

Every condition that should keep a spreadsheet row out of the live
storefront is represented the same way: the imported row is still written
to the database, with `isActive: false`, never omitted from the import.
Product listing and detail queries already filter on `isActive`, so a
`false` value is sufficient to keep a row out of the storefront without
introducing a second mechanism for "exists but hidden." This applies to:

- Rows from the spreadsheet's archived tab.
- Rows from the spreadsheet's not-yet-verified tab, matched to the
  correct product variant by family name plus variant name, not applied
  to an entire product family at once — a family can have some variants
  verified and others not.
- Rows whose price is missing or does not parse as a number. An
  unparseable price never produces an invented or zero price value; it
  produces an inactive row instead, so a pricing gap in the source data
  cannot silently reach the storefront as a wrong price.

Keeping every row in the database, rather than dropping the ones that
fail one of these checks, means re-running the import after the
spreadsheet is corrected (a variant gets verified, a price is fixed) only
has to flip `isActive`, not recreate a row that import previously
discarded.

## `ProductAttribute` as the model for nutrition, regulated text, and FAQ content

`ProductAttribute` (a generic per-product key/value table) is the storage
for three kinds of content the spreadsheet carries that do not fit the
existing typed columns, without a schema migration:

- Nutrition facts: up to nine `nutrition.*`-prefixed keys, one row per
  field. A row is only created when the spreadsheet actually has a value
  for that field; a product with fewer than nine known nutrition values
  gets fewer than nine rows, never blank-padded to a fixed count.
- `ingredients`, `allergens`, and `mayContainTraces`: stored as
  Dutch-only text under those exact keys, deliberately not passed through
  the Translation API. This is regulated, technical content; it is
  imported as-is so a human can review and translate it deliberately,
  rather than shipping a machine translation of allergen text
  unreviewed.
- FAQ content: up to two question/answer pairs, keyed
  `faq.1.question`, `faq.1.answer`, `faq.2.question`, `faq.2.answer`.

Content that varies by locale is stored as separate rows per locale,
using a locale-suffixed key (`faq.1.question.nl`, `faq.1.question.en`,
`faq.1.question.fr`), the same convention introduced for
`ProductTranslation`-style data but applied to the key/value table instead
of a dedicated column set. `toProductAttributesDto` in `lib/queries.ts` is
the one place that resolves this: for a locale-suffixed key it keeps only
the row matching the current request locale and strips the suffix before
returning it, so every caller of the product query sees a plain `faq.1.question`
key already resolved to the right language, never the suffixed form.
Nutrition keys and the three regulated-text keys are treated as
non-localized and pass through unchanged, since they carry no locale
suffix to begin with.

## Product images matched from the existing bucket, not the spreadsheet

The spreadsheet's own image-link column is empty on every row, so
`prisma/seed.ts` does not use it. Instead, product and variant images are
matched from the Cloud Storage bucket described in `docs/CLOUD_SETUP.md`,
using the product's SKU and category to locate the right files. Three
refinements to that matching were needed once real bucket contents were
imported against:

- The bucket marks which images are live (as opposed to superseded or
  draft) with a "Gebruikt" folder, but that folder does not sit at a
  fixed depth in every product's path. Matching searches a file's full
  path for that marker at any depth, rather than assuming a fixed
  folder structure. A product folder that contains no marker at all is
  treated as fully live — every image under it is used — rather than
  treated as having no live images.
- A variant's SKU in the spreadsheet includes a weight suffix that a
  bucket filename's base SKU does not always carry. When the full
  spreadsheet SKU does not match any filename, matching falls back to
  the SKU with that suffix stripped.
- As a last resort, when neither SKU match succeeds, a product family
  is matched to a bucket folder by comparing the words in the family
  name against the words in candidate folder names within the same
  category, rather than requiring an exact slug match. This only
  applies within the product's own category, so it cannot match a
  folder belonging to an unrelated product line.

## Known gap: seeded stock is always zero

Every `ProductVariant.stock` value written by the import is `0`. The
spreadsheet's stock-status column is read and used only as one of the
inputs to the `isActive` decision (an out-of-stock or discontinued status
can make a row inactive); it is never mapped to an actual numeric stock
count, because no such count exists in the source data yet. This is a
deliberate, known gap, not a bug: real inventory counts are still being
gathered by the site owner and will be wired into the import once they
exist. Any future phase that adds stock display or stock-based
availability logic needs a real count source before that column can be
anything other than a hardcoded zero.

## Product detail page composition

`app/[locale]/products/[product]/page.tsx` composes the product detail
view from existing and new pieces rather than introducing a new page
pattern: `ProductGallery` (image thumbnails with a main-image swap) and
`VariantSelector` (the product's weight/variant options) are new,
product-domain-specific components; `FavoriteButton` and `Tabs` are
reused as-is from the design-system work in the previous phase. The three
`Tabs` panels are each driven by data that may or may not exist per
product rather than being unconditionally rendered: the description tab
reads the product's translated description directly; the nutrition tab
builds its table only from whichever `nutrition.*` attributes that
product actually has; the FAQ tab builds its list from whichever `faq.*`
attributes exist for that product's locale, falling back to a short
static set of questions only for a product that genuinely has none.

The Add to Cart control on this page has no click handler and creates no
cart state. This is intentional, not an oversight: cart and checkout
logic remains out of scope for this phase, consistent with earlier
phases' deferral of checkout, and the button exists at this point only to
complete the page's visual layout.
