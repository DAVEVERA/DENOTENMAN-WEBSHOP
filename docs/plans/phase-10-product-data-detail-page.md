# Phase 10: Product Data Import & Detail Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the catalog's empty/stale database with real product data
imported from an authoritative Google Sheets spreadsheet (translated from
Dutch into English and French via the Google Cloud Translation API,
images matched from the existing Cloud Storage bucket by SKU), then build
the real product detail page — image gallery, price, weight-variant
toggle, favorite button, and tabs wired to real description, nutrition,
and FAQ content.

**Architecture:** The spreadsheet is the single source of truth for the
catalog. `prisma/seed.ts` becomes the one-way import pipeline: spreadsheet
→ translate → match images → write to Postgres via Prisma. Nutrition,
ingredients, allergens, and FAQ content live in the existing generic
`ProductAttribute` key/value table — no schema migration. The product
detail page reads through `lib/queries.ts` exactly like every other page,
with `getProductBySlug` extended to include attributes. This is an
import-pipeline scope, not an admin UI: the spreadsheet stays the
editable source; re-running the import propagates updates.

**Tech Stack:** Next.js 16 (App Router), Prisma 6 + Neon Postgres,
`@google-cloud/storage` (already installed), `googleapis` (new dependency,
for Sheets API access) and `@google-cloud/translate` (new dependency).
Both new packages use Application Default Credentials — no key files in
the repository, consistent with the existing Storage client.

## Global Constraints

- `prisma/seed.ts` remains the only file responsible for seed/import
  logic, per `docs/STRUCTURE.md`. No import logic in `lib/` or `app/`.
- No file may be authored with or reference any tool, generator, or
  author name. No prose or long explanatory comments in code files.
- Prices are stored as integer cents, never floats. The spreadsheet's
  price column uses `€ X,XX` formatting (comma decimal separator, Dutch
  locale) — parse accordingly, do not assume a period decimal separator.
- Every row in the spreadsheet's `Developer_export` tab is imported.
  Nothing is silently dropped. Rows from the spreadsheet's
  `Archief_niet_actief` tab, rows marked unverified in its
  `Controle_overzicht` tab, and rows with no price value are imported
  with `isActive: false` on the affected `Product` and/or
  `ProductVariant` rows — never skipped, never given an invented price.
- `isActive: false` is the only mechanism for excluding a row from
  storefront display. `getMainCategories`, `getFilteredProducts`,
  `getProductBySlug`, and the sitemap slug queries already filter on
  `isActive` — no new filtering logic is needed, only correct data.
- Product images are matched from the existing `GCS_BUCKET` (bucket
  layout: `Category/ProductFolder/Gebruikt/*.webp`, only `Gebruikt`-
  prefixed subfolders are live), matched by SKU/product-folder name — not
  from the spreadsheet's own image-link column, which is empty on every
  row.
- Translation runs through Google Cloud Translation API (NL → EN, NL →
  FR) using Application Default Credentials, called from within
  `prisma/seed.ts` directly — no new `lib/` module, since translation is
  only used by the one-time/repeatable import, not the running
  application.
- No cart logic. The Add to Cart button on the detail page is rendered,
  labeled from the existing `product.addToCart` dictionary key, and
  disabled when the selected variant is out of stock — no click handler,
  no cart state anywhere. This matches `docs/IMPLEMENTATION_PLAN.md`'s
  original deferral of checkout.
- Mobile-first throughout: unprefixed Tailwind classes describe the phone
  layout; `lg:` only adds/overrides for wider viewports.
- Respect `docs/STRUCTURE.md` at all times: new components go in
  `components/product/`; `lib/` stays framework-agnostic; translation
  JSON stays in `dictionaries/`; no folders outside the contract without
  a `docs/STRUCTURE.md` amendment (Task 7 makes the needed amendments).
- Stop after this plan is fully implemented and verified — no additional
  features beyond what is listed here (no cart logic, no admin UI, no
  category-page changes).

---

## Task 1: Add Sheets and Translation API clients

**Files:** `package.json`, `package-lock.json`

Add two dependencies: `googleapis` (for reading the spreadsheet via the
Sheets API v4) and `@google-cloud/translate` (v3 client, for the
Translation API). Both authenticate via Application Default Credentials —
no new environment variable is required beyond what `gcloud auth
application-default login` or the deployed runtime's workload identity
already provides, matching the existing `@google-cloud/storage` usage in
`prisma/seed.ts`.

Do not wire any usage yet — this task only adds and installs the
dependencies so Task 2 can import them.

**Verification:** `npm install` completes cleanly; `npm run build` still
succeeds (no usage yet, so no behavior change).

---

## Task 2: Rewrite `prisma/seed.ts` as the spreadsheet-driven import

**Files:** `prisma/seed.ts`

Replace the current category-inference/synthetic-generation logic
(everything from the GCS-grouping loop through the smart-pricing and
smart-attribute-inference blocks) with a spreadsheet-driven import. Keep
`seedPages()` and the top-of-file `pageTitles`/locale constants untouched.

**Spreadsheet access:** Read tab `Developer_export` from spreadsheet ID
`1vAOAxa3YsQy_u5M5_gHL4rBr_MTUtp7a` via the Sheets API v4
(`spreadsheets.values.get`, range covering the full used range of that
tab). This tab is the trimmed, import-intended copy of `Productlijst`
(same data, drops internal-only notes columns). Do not use any cached
text export — fetch fresh, per-row, per-column values directly from the
API so row boundaries and cell values are unambiguous.

**Column → field mapping** (`Developer_export` header row, in order):
`Product ID`, `SKU`, `EAN code`, `Publiceren`, `Zichtbaarheid`,
`Hoofdcategorie`, `Subcategorie`, `Primaire categorie`, `Secundaire
categorieën`, `Productfamilie`, `Variantnaam`, `Productnaam webshop`,
`Producttype`, `Bewerking`, `Zoutstatus`, `Vorm`, `Smaak`, `Kleur/type`,
`Biologisch`, `Vegan`, `Glutenvrij`, `Gewicht label`, `Gewicht in gram`,
`Verpakking`, `Prijs`, `Inkoopprijs`, `Marge %`, `Voorraadstatus`,
`Levertijd`, `Seizoensproduct`, `Ingrediënten`, `Allergenen`, `Kan sporen
bevatten van`, `Energie kJ per 100g`, `Energie kcal per 100g`, `Vet per
100g`, `Waarvan verzadigd per 100g`, `Koolhydraten per 100g`, `Waarvan
suikers per 100g`, `Vezels per 100g`, `Eiwitten per 100g`, `Zout per
100g`, `SEO titel`, `Meta omschrijving`, `H1 titel`, `URL slug`, `Korte
producttekst`, `Lange producttekst`, `FAQ vraag 1`, `FAQ antwoord 1`,
`FAQ vraag 2`, `FAQ antwoord 2`, `Supabase afbeelding URL`, `Hoofdfoto
bestandsnaam`, `Afbeelding alt-tekst`.

Read the header row itself rather than hardcoding column indexes, and
look up each field by header name — the exact column order in the sheet
is not a contract, only the header names are.

**Grouping:** One `Product` per distinct `Productfamilie` value. Rows
sharing the same `Productfamilie` become that product's `ProductVariant`
rows (distinguished by `Gewicht in gram`).

**Category resolution:** Read the `SKU_reeksen` tab's embedded
`Categorie_mapping` sub-table once at the start of the import to resolve
`Hoofdcategorie`/`Subcategorie` text to the canonical category slug and
name. Create one `Category` per distinct resolved main category (reuse
the existing `slugify`/`cleanName` helpers already in the file), with
`CategoryTranslation` rows generated via translation (see below), same as
`Product`. Keep the existing "acties" `PROMOTIONAL` category creation
logic as-is.

**SKU:** Use the `SKU` column value; where blank, fall back to the
existing deterministic-SKU-generation logic already in the file (category
abbreviation + product-folder abbreviation), with the existing
duplicate-safe suffixing loop preserved as-is.

**Translation:** For each Dutch source string that needs an EN/FR
counterpart (`Productfamilie`/`Productnaam webshop` → name, `Lange
producttekst` → description, `Korte producttekst` if used, `Gewicht
label` → variant label, `SEO titel`, `Meta omschrijving`, `FAQ vraag
1/2`, `FAQ antwoord 1/2`, category names), call the Translation API.
Batch calls per product (translate all of a product's Dutch fields to EN
in one call, all to FR in one call) rather than one API call per field,
to keep the import from making hundreds of individual network calls.
`URL slug` is not translated as free text — generate translated slugs by
slugifying the *translated* name for `en`/`fr`, keeping the sheet's own
NL slug for `nl` (reuse the existing `slugify` helper), respecting the
schema's `(locale, slug)` uniqueness constraint with the same
duplicate-safe suffixing pattern already used for SKUs.

**Price parsing:** Parse `Prijs` from its `€ X,XX` text format (Dutch
comma decimal separator) into integer cents. A blank/unparseable price
means: create the variant/product but set `isActive: false` on it, price
field set to `0` (never invented), and skip it from
`basePriceCents`-driving logic (use the first variant with a real price
as the product's base price if any exists, else `0` with the product also
inactive).

**Enum mapping:** Map `Bewerking` text to `Preparation` (e.g. "Geroosterd"
→ `ROASTED`, "N.v.t." or unrecognized → `RAW`), `Zoutstatus` to `Salting`
(e.g. contains "Gezouten" → `SALTED`, else `UNSALTED`). `Coating` stays
`NONE` unless the resolved category or `Producttype`/`Smaak` text clearly
indicates a chocolate coating (reuse the existing chocolade-category-slug
check already in the file). Unrecognized/ambiguous text falls back to the
enum default — never guessed beyond simple substring matching consistent
with the current file's existing approach.

**Attributes:** For each product, create `ProductAttribute` rows (not
translated — these are internal keys with locale-agnostic values or
handled via the DTO layer in Task 4):

- `ingredients` = `Ingrediënten` (Dutch text; Task 4/6 handle
  presentation, no translation of this field in Task 2 — flag this
  explicitly as Dutch-only in the phase's final report since ingredient
  lists are regulated/technical text better reviewed by a human before
  translating)
- `allergens` = `Allergenen`
- `mayContainTraces` = `Kan sporen bevatten van`
- `nutrition.energyKj`, `nutrition.energyKcal`, `nutrition.fat`,
  `nutrition.saturatedFat`, `nutrition.carbohydrates`,
  `nutrition.sugars`, `nutrition.fiber`, `nutrition.protein`,
  `nutrition.salt` = the corresponding nine per-100g numeric columns,
  stored as string values (skip creating a row for any column that's
  blank on that row rather than writing an empty string)
- `faq.1.question`, `faq.1.answer`, `faq.2.question`, `faq.2.answer` =
  the two FAQ pairs where present, translated to EN/FR alongside the
  product's other translated fields (store one attribute row per locale
  variant is not needed — see Task 4/6 for how these become
  locale-specific display; for Task 2's purposes, store the NL value plus
  translated EN/FR values as separate keys, e.g. `faq.1.question.nl`,
  `faq.1.question.en`, `faq.1.question.fr`, so Task 4's query layer can
  select the right one per locale without a schema change)

**Images:** Keep the existing GCS bucket-listing and `Gebruikt`-folder
filtering logic from the current file. Match bucket objects to
spreadsheet products by SKU or product-folder name (case-insensitive,
same normalization already used for category/product folder names in the
current file). Link matched images via `ProductImage.create`, first match
`isPrimary: true`, same as current behavior.

**Row exclusion handling:** Fetch `Archief_niet_actief` and
`Controle_overzicht` tabs as well. Cross-reference by SKU/product
identifier: any `Developer_export` row whose SKU also appears in
`Archief_niet_actief`, or is flagged unverified/"red" in
`Controle_overzicht`, is imported with `isActive: false` rather than
excluded. If a product genuinely only exists in `Archief_niet_actief` and
not in `Developer_export` at all, it is not imported (the active-source
tab is the row list to iterate; the other two tabs are only consulted for
flagging, not as a separate row source).

**Structure preserved:** Keep the delete-and-reseed pattern already in
the file (`deleteMany()` calls in existing dependency order), the GCS
connection setup, and the final `seedPages()` call.

**Verification:** `npx tsc --noEmit` on the file passes (or equivalent
type-check); no seed run yet (Task 3 runs it) — this task is code-complete
but not yet executed against the real database.

---

## Task 3: Run and verify the import

**Files:** none (operational task — running the seed script, not editing
code)

Run `npx prisma db seed` against the configured `DATABASE_URL` and
`GCS_BUCKET`, with Application Default Credentials active for Sheets and
Translation API access.

**Verification:**

- Command completes without error.
- Query row counts for `Product`, `ProductVariant`, `ProductImage`,
  `Category`, `ProductAttribute` — all non-zero, and the `Product`/
  `ProductVariant` counts are plausible against the spreadsheet's own
  `Dashboard` tab figures (254 active variant rows, 193 product
  families, 12 main categories, 104 archived rows).
- Spot-check: query a handful of products and confirm `ProductAttribute`
  rows exist for `nutrition.*`, `allergens`, and `faq.*` keys.
- Spot-check: confirm `ProductTranslation` rows for `en`/`fr` locales
  contain text genuinely different from the `nl` row (not a copy) for
  several sampled products.
- Spot-check: confirm at least one row sourced from `Archief_niet_actief`
  or flagged unverified exists in the database with `isActive: false`.
- Report exact row counts per table in the task report.

---

## Task 4: Extend `lib/queries.ts` for attributes

**Files:** `lib/queries.ts`

Add `attributes: true` to the `include` clause in `getProductBySlug`'s
Prisma query (alongside the existing `translations`, `images`,
`variants`). Extend `ProductDetailDto` with:

```ts
export type ProductAttributeDto = {
  key: string;
  value: string;
};
```

and add `attributes: ProductAttributeDto[]` to `ProductDetailDto`. Map
`product.attributes` to this shape in `getProductBySlug`'s return,
filtering to only the keys relevant to the current locale for any
locale-suffixed keys from Task 2 (`faq.1.question.nl` /`.en`/`.fr`,
etc.): for a locale-suffixed key, strip the locale suffix and include
only the row matching the requested locale; for a non-suffixed key
(`nutrition.*`, `allergens`, `mayContainTraces`, `ingredients`), include
it as-is for every locale. This follows the existing flat,
locale-resolved DTO convention used everywhere else in this file — never
return raw Prisma models.

**Verification:** `npm run build` succeeds; the DTO shape change doesn't
break any existing caller of `getProductBySlug` (only one caller today:
the product detail page rebuilt in Task 6).

---

## Task 5: Dictionary additions

**Files:** `dictionaries/nl.json`, `dictionaries/en.json`,
`dictionaries/fr.json`

Add to the `product` section of all three files (exact key set identical
across all three, values translated appropriately per locale):
`nutritionEnergy`, `nutritionFat`, `nutritionSaturatedFat`,
`nutritionCarbohydrates`, `nutritionSugars`, `nutritionFiber`,
`nutritionProtein`, `nutritionSalt`, `ingredients`, `allergens`,
`mayContainTraces`, `weight`, `perHundredGrams` (if
`pricePerHundredGrams` doesn't already cover the nutrition-table context
— check the existing key first and reuse it if it fits, otherwise add a
distinct one for the nutrition table heading).

**Verification:** All three files remain valid JSON; a script or manual
diff confirms identical key sets across `nl`/`en`/`fr` (same check used
in prior phases).

---

## Task 6: Rebuild the product detail page

**Files:** `app/[locale]/products/[product]/page.tsx` (rewrite),
`components/product/ProductGallery.tsx` (new),
`components/product/VariantSelector.tsx` (new)

**`ProductGallery.tsx`** (client component): takes `images:
ProductImageDto[]` and `productName: string`. Renders the currently
selected image large (defaulting to the primary image, or the first
image if none is marked primary), with a thumbnail strip below/beside it
(`flex` row, wrapping, mobile-first: below the main image on narrow
viewports). Clicking a thumbnail swaps the main image via local `useState`
for the selected index. If there are zero or one images, render just the
single image (or the same empty-state placeholder pattern
`ProductCard.tsx` already uses) with no thumbnail strip.

**`VariantSelector.tsx`** (client component): takes `variants:
ProductVariantDto[]`, `locale: Locale`, and an `onChange:
(variant: ProductVariantDto) => void` callback (or manages its own
state and exposes the selected variant via a render-prop/children
pattern — implementer's choice, follow the codebase's existing
client-component patterns like `Tabs.tsx`/`FavoriteButton.tsx` for
style). Renders one button/pill per variant (labeled from
`variant.label`, the locale-resolved weight label), toggles a selected
state, defaults to the first active variant (or first variant if none
active). Does not render a variant with `isActive: false` as selectable —
excluded from the toggle entirely, consistent with the sitewide
`isActive` filtering convention.

**`page.tsx` rebuild:** Fetch `data` via `getProductBySlug` (unchanged
call). Render, mobile-first (stacked; `lg:` two-column):

- `ProductGallery` with `data.images`.
- Product name (`h1`, existing heading classes from the current stub),
  `FavoriteButton` (from `components/ui/FavoriteButton.tsx`) placed next
  to the title, with `label={{ on: dict.product.removeFromFavorites, off:
  dict.product.addToFavorites }}` (uninitialized/local state — no
  favorites persistence exists anywhere else in the app either, so this
  matches `ProductCard`'s or any other existing favorite-button usage's
  current scope).
- `VariantSelector` with `data.variants`; price below it via
  `formatPrice(selectedVariant.priceCents, locale)` from `lib/format.ts`;
  `dict.product.outOfStock` text shown when the selected variant's
  `stock` is `0` or it's `isActive: false`.
- Add to Cart: `components/ui/Button.tsx`, label
  `dict.product.addToCart`, `disabled` when the selected variant is out
  of stock, no `onClick`.
- `Tabs` (from `components/ui/Tabs.tsx`) with three tabs:
  - `tabDescription` (label from dict) → tab content is `data.description`
    in a `<p>`.
  - `tabNutrition` (label from dict) → tab content is a simple table/dl
    built from `data.attributes` filtered to `nutrition.*` keys, each row
    labeled via the Task 5 dictionary keys, only rendering rows that
    exist (some products may be missing individual nutrition fields).
  - `tabFaq` (label from dict) → tab content built from
    `data.attributes`' `faq.1.question`/`faq.1.answer`/`faq.2.question`/
    `faq.2.answer` keys (already locale-resolved by Task 4's query
    layer) where present; if no FAQ attributes exist for this product,
    render a short static fallback paragraph (no per-product FAQ schema
    beyond what Task 2 populates).

The page needs its dictionary loaded — follow the existing pattern used
by `layout.tsx` for this route (or `SiteShell`'s existing dictionary-
loading convention) to get `dict` into the page component; do not
introduce a second dictionary-loading mechanism.

**Verification:** `npm run build` succeeds. Live Playwright CLI check at
mobile width first, then desktop, against a real seeded product: gallery
thumbnail click swaps the main image; variant toggle updates displayed
price and out-of-stock messaging; `Tabs` keyboard navigation
(arrow/home/end) still works per its existing a11y contract; `FavoriteButton`
toggles visually; Add to Cart is visibly disabled when the selected
variant is out of stock; switching the URL's locale segment shows
genuinely distinct EN/FR/NL text (name, description, tab labels, and tab
content).

---

## Task 7: Documentation

**Files:** `docs/ARCHITECTURE.md`, `docs/CLOUD_SETUP.md`,
`docs/STRUCTURE.md`

**`docs/ARCHITECTURE.md`:** Append a Phase 10 section documenting: the
spreadsheet as the catalog's source of truth and `prisma/seed.ts` as the
one-way import pipeline; Google Cloud Translation API as the NL→EN/FR
mechanism, called at import time only; `isActive: false` as the sole
mechanism for representing archived/unverified/unpriced spreadsheet rows
in the database without excluding them from it; `ProductAttribute` as the
nutrition/ingredients/allergens/FAQ data model, including the
locale-suffixed key convention (`faq.1.question.en`, etc.) introduced in
Task 2 for attributes that need per-locale values without a schema
change; the fact that `ingredients`/`allergens`/`mayContainTraces` remain
Dutch-only pending human review before translating regulated/technical
text.

**`docs/CLOUD_SETUP.md`:** Add a new numbered section (after the existing
CDN section) documenting the two new cloud capabilities: Google Sheets
API read access (for the import script to read the source spreadsheet)
and Google Cloud Translation API (Cloud Translation API User role, or
equivalent minimal role), both using Application Default Credentials,
consistent with the existing service-account/IAM conventions already
documented for Storage.

**`docs/STRUCTURE.md`:** Add `ProductGallery.tsx` and
`VariantSelector.tsx` to the `components/product/` bullet point, matching
the existing pattern used for `ProductCard.tsx`.

**Verification:** All three files remain prose-only per the hard
constraints; no code/config in `.md` files.

---

## Task 8: Full verification

Run the complete verification checklist from every prior task in
sequence against the final state of the branch: `npm run build`;
`npx prisma db seed` idempotency check (running it a second time
produces the same row counts, not duplicates, given the existing
delete-and-reseed pattern); dictionary key parity across all three
locale files; a final live Playwright CLI pass over the product detail
page at mobile and desktop widths, on at least two different real
products (one with a full nutrition/FAQ data set, one with any gaps
found during Task 3's spot-check) to confirm graceful handling of
missing attribute data.
