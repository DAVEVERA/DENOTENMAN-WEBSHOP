# Phase 8: Opschoning en UI-fundering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `middleware.ts` to `proxy.ts`, clean up build config, and establish a Tailwind v4 design-token system, brand components (Header/Footer/Logo/LocaleSwitcher/Container/ProductCard), and copy-in-dictionaries discipline, then apply it across all existing pages without touching query logic.

**Architecture:** Tailwind v4 with a single `@theme` block in `app/globals.css` as the only source of design tokens (colors, fonts, spacing scale). A new `lib/alternates.ts` becomes the single source of truth for cross-locale URLs, replacing the three duplicated inline `slugsByLocale`-based `generateMetadata` blocks in `categories/[category]`, `products/[product]`, and `pages/[slug]`, and newly wiring `blogs/articles/[slug]`. `app/[locale]/layout.tsx` composes `Header`/`Footer`/skip-link around `{children}`, sourcing nav categories from a new `getMainCategories` query and locale alternates from `lib/alternates.ts`. All new components are server components except `LocaleSwitcher`, which is a client component that receives pre-resolved alternates as a prop — it does no route or slug construction itself.

**Tech Stack:** Next.js 16.3.0 (App Router), React 19.2.8, Prisma 6, Tailwind CSS 4 + `@tailwindcss/postcss`, `clsx` + `tailwind-merge`, `lucide-react`, `next/font/google` (Dosis, Montserrat).

## Global Constraints

- Respect `docs/STRUCTURE.md` at all times: components go in `components/{ui,layout,product,category}`; framework-agnostic logic only in `lib/`; no prose in code files; no tool/generator/author name anywhere.
- No new packages beyond: `tailwindcss@4`, `@tailwindcss/postcss`, `clsx`, `tailwind-merge`, `lucide-react`, `zod` (zod already present as a dependency — do not duplicate). No axios, no date-fns, no CSS-in-JS, no component library.
- Pin all new dependency versions in the same style as the rest of `package.json` (caret ranges — every existing entry uses `^`, confirmed in Task 1).
- No hardcoded hex colors, color pixel values, or inline styles in components — tokens and Tailwind classes only.
- No hardcoded brand copy in components — all strings are dictionary keys across `nl`, `en`, `fr`.
- No `try/catch` around page query calls (existing pages already respect this — do not introduce any).
- All components are server components unless interactivity makes that impossible. Only `LocaleSwitcher` is a client component.
- `next.config.ts`'s import chain must use only relative imports for value imports (type-only imports exempt).
- Accent yellow (`#E0B200`) is for fills, buttons, underlines, highlights — **never** as text color on the light background. Text on accent yellow is `#333333` or the contrast black.
- `lib/alternates.ts` is the only place a cross-locale URL is constructed. Nothing else builds one. Missing translation → omit that locale from hreflang; `LocaleSwitcher` falls back to that locale's homepage, never a guessed URL.
- Wrap the alternates DB lookup in React `cache()` so a single request computes it once even when both `generateMetadata` and the page component call it.
- Stop after this plan is fully implemented and verified — no additional features beyond what is listed here.

---

## File Structure

**New files:**
- `proxy.ts` (root) — replaces `middleware.ts`
- `postcss.config.mjs` (root)
- `app/globals.css` — single `@theme` token block
- `lib/cn.ts` — `cn()` helper
- `lib/format.ts` — `formatPrice`, `formatDate`
- `lib/alternates.ts` — single source of truth for cross-locale URLs
- `components/ui/Container.tsx`
- `components/ui/Logo.tsx`
- `components/layout/Header.tsx`
- `components/layout/Footer.tsx`
- `components/layout/LocaleSwitcher.tsx` (client component)
- `components/product/ProductCard.tsx`
- `public/brand/` (directory only, assets added later by the user)

**Modified files:**
- `package.json` — `prisma`/`tsx` untouched from prior phase; add build script change, new dependencies
- `next.config.ts` — add `turbopack.root`
- `lib/queries.ts` — add `getMainCategories`
- `app/[locale]/layout.tsx` — Header/Footer/skip-link/typography, alternates via `lib/alternates.ts`, fonts
- `app/[locale]/page.tsx` — use `ProductCard`, `Container`
- `app/[locale]/categories/page.tsx` — use `ProductCard`, `Container`
- `app/[locale]/categories/[category]/page.tsx` — use `ProductCard`, `Container`, alternates via `lib/alternates.ts`
- `app/[locale]/products/[product]/page.tsx` — `Container`/typography, alternates via `lib/alternates.ts`
- `app/[locale]/pages/[slug]/page.tsx` — `Container`/typography, alternates via `lib/alternates.ts`
- `app/[locale]/cart/page.tsx` — `Container`/typography only
- `app/[locale]/account/page.tsx` — `Container`/typography only
- `app/[locale]/blogs/articles/page.tsx` — `Container`/typography only
- `app/[locale]/blogs/articles/[slug]/page.tsx` — `Container`/typography, new `generateMetadata` via `lib/alternates.ts`
- `dictionaries/nl.json`, `dictionaries/en.json`, `dictionaries/fr.json` — add `brand.baseline`, `nav.skipToContent`, `brand.logoMarkAlt`, `brand.logoWordmarkAlt`, footer legal link labels
- `docs/ARCHITECTURE.md` — styling decision, accent rule, Intl rationale, alternates helper docs, `getMainCategories` docs
- `docs/STRUCTURE.md` — components/, public/brand/, globals.css-only-tokens rule

**Deleted files:**
- `middleware.ts`

---

## Task 1: Proxy migration, turbopack root, build script

**Files:**
- Create: `proxy.ts`
- Delete: `middleware.ts`
- Modify: `next.config.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: existing `defaultLocale`, `isLocale` from `lib/i18n.ts` (unchanged).
- Produces: nothing consumed by later tasks — this task is self-contained infra cleanup.

- [ ] **Step 1: Create `proxy.ts` with the ported logic**

Copy `middleware.ts` verbatim, renaming the exported function to a default export named `proxy` (Next 16 convention — the file name and the expected export both change; matcher config key stays `config`):

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { defaultLocale, isLocale } from "@/lib/i18n";

function detectLocaleFromHeader(acceptLanguage: string | null): string {
  if (!acceptLanguage) {
    return defaultLocale;
  }

  const preferred = acceptLanguage
    .split(",")
    .map((part) => part.split(";")[0]?.trim().slice(0, 2).toLowerCase())
    .find((lang) => lang && isLocale(lang));

  return preferred ?? defaultLocale;
}

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const segments = pathname.split("/");
  const firstSegment = segments[1];

  if (firstSegment && isLocale(firstSegment)) {
    return NextResponse.next();
  }

  const locale = detectLocaleFromHeader(request.headers.get("accept-language"));

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;

  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
```

- [ ] **Step 2: Delete `middleware.ts`**

Delete the file entirely. Do not leave a re-export or alias.

- [ ] **Step 3: Add `turbopack.root` to `next.config.ts`**

In `next.config.ts`, add a `turbopack` key to `nextConfig` pointing at the project root using a relative-import-safe construction (no `@/` alias, per the hard constraint on `next.config.ts`'s import chain):

```typescript
import path from "node:path";
```

Add near the top of the file (with the other imports), and add to `nextConfig`:

```typescript
const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    // ...unchanged
  },
  // ...unchanged
};
```

- [ ] **Step 4: Change the build script in `package.json`**

Change:
```json
"build": "next build",
```
to:
```json
"build": "prisma generate && next build",
```

- [ ] **Step 5: Verify proxy works and config loads**

Run: `npx tsc --noEmit`
Expected: no errors related to `proxy.ts` or `next.config.ts`.

Run: `npm run dev` briefly (or `next build` later in Task 12) to confirm no "middleware.ts not found" or turbopack root warnings appear. Stop the dev server after confirming startup logs are clean.

- [ ] **Step 6: Commit**

```bash
git add proxy.ts next.config.ts package.json
git rm middleware.ts
git commit -m "chore: migrate middleware to proxy, set turbopack root, generate prisma client on build"
```

---

## Task 2: Add styling dependencies

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json` (regenerated, not hand-edited)

**Interfaces:**
- Consumes: nothing.
- Produces: `tailwindcss`, `@tailwindcss/postcss`, `clsx`, `tailwind-merge`, `lucide-react` available for later tasks; `zod` already present, do not re-add.

- [ ] **Step 1: Determine current pinned versions**

Run: `npm view tailwindcss version`, `npm view @tailwindcss/postcss version`, `npm view clsx version`, `npm view tailwind-merge version`, `npm view lucide-react version`

Use the latest stable version returned for each (major line: tailwindcss 4.x). Record the exact versions returned before editing `package.json`.

- [ ] **Step 2: Add to `package.json`**

Add `clsx`, `tailwind-merge`, and `lucide-react` to `dependencies` (alphabetical among existing entries, matching current key order convention: `@google-cloud/storage`, `@prisma/client`, `clsx`, `lucide-react`, `next`, `prisma`, `react`, `react-dom`, `tailwind-merge`, `zod`). Add `tailwindcss` and `@tailwindcss/postcss` to `devDependencies` (alphabetical: `@tailwindcss/postcss`, `@types/node`, `@types/react`, `tailwindcss`, `tsx`, `typescript`). Use caret ranges (`^`) matching every existing entry's style.

- [ ] **Step 3: Install and regenerate lockfile**

Run: `npm install`

- [ ] **Step 4: Verify install**

Run: `npx tsc --noEmit`
Expected: no new type errors (these packages aren't imported yet).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add tailwind v4, clsx, tailwind-merge, lucide-react"
```

---

## Task 3: Tailwind v4 setup with design tokens

**Files:**
- Create: `postcss.config.mjs`
- Create: `app/globals.css`

**Interfaces:**
- Consumes: `tailwindcss`, `@tailwindcss/postcss` from Task 2.
- Produces: CSS custom properties (`--color-background`, `--color-text`, `--color-accent`, `--color-contrast`, `--color-surface`, `--color-border`, `--color-muted`, `--color-accent-hover`, `--font-heading`, `--font-body`, `--tracking-heading`, `--font-weight-heading`) available as Tailwind utility classes (`bg-background`, `text-text`, `bg-accent`, etc.) for every later component task.

- [ ] **Step 1: Create `postcss.config.mjs`**

```javascript
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

- [ ] **Step 2: Create `app/globals.css` with the single `@theme` token block**

Derive borders, muted text, and hover states from the five brand colors, staying in the same warm tone as the background (`#F6F3EE`) — no second palette:

```css
@import "tailwindcss";

@theme {
  --color-background: #F6F3EE;
  --color-text: #333333;
  --color-accent: #E0B200;
  --color-accent-hover: #C69C00;
  --color-contrast: #141414;
  --color-surface: #FFFFFF;
  --color-border: #E4DFD5;
  --color-muted: #7A7367;

  --font-heading: var(--font-dosis);
  --font-body: var(--font-montserrat);

  --tracking-heading: 0.02em;
  --font-weight-heading: 600;
}

*:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
```

`--font-dosis` and `--font-montserrat` are CSS variables that `next/font/google` will inject via `className` on `<html>` in Task 8 — declaring them here lets Tailwind's `font-heading`/`font-body` utilities resolve to the actual font stack once that variable is present on an ancestor element.

- [ ] **Step 3: Verify Tailwind compiles**

This is verified indirectly in Task 12 (`npm run build`) once `globals.css` is imported by the root layout in Task 8. No standalone build step exists before that — do not run `next build` yet if `app/layout.tsx` doesn't import `globals.css`; check now:

Run: `npx tsc --noEmit`
Expected: no errors (CSS files aren't type-checked, this just confirms nothing else broke).

- [ ] **Step 4: Commit**

```bash
git add postcss.config.mjs app/globals.css
git commit -m "feat: add tailwind v4 config and design token theme"
```

---

## Task 4: `lib/cn.ts` and `lib/format.ts` helpers

**Files:**
- Create: `lib/cn.ts`
- Create: `lib/format.ts`

**Interfaces:**
- Consumes: `clsx`, `tailwind-merge` from Task 2.
- Produces: `cn(...inputs: ClassValue[]): string` from `lib/cn.ts`; `formatPrice(amountCents: number, locale: Locale): string` and `formatDate(date: Date, locale: Locale): string` from `lib/format.ts`. Both consumed by every component task from Task 5 onward.

- [ ] **Step 1: Create `lib/cn.ts`**

```typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 2: Create `lib/format.ts`**

`formatPrice` takes an amount in whole cents (matching `basePriceCents`/`priceCents` in `lib/queries.ts`) and returns EUR-notation per locale via `Intl.NumberFormat`. `formatDate` uses `Intl.DateTimeFormat`. No date library.

```typescript
import type { Locale } from "@/lib/i18n";

export function formatPrice(amountCents: number, locale: Locale): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
  }).format(amountCents / 100);
}

export function formatDate(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}
```

- [ ] **Step 3: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/cn.ts lib/format.ts
git commit -m "feat: add cn helper and Intl-based price/date formatting"
```

---

## Task 5: `getMainCategories` query

**Files:**
- Modify: `lib/queries.ts`
- Modify: `docs/ARCHITECTURE.md`

**Interfaces:**
- Consumes: `prisma`, `resolveTranslation`, `Locale` — all already in `lib/queries.ts`.
- Produces: `export type MainCategoryDto = { id: string; slug: string; name: string }` and `export async function getMainCategories(locale: Locale): Promise<MainCategoryDto[]>`, consumed by `Header` in Task 9.

- [ ] **Step 1: Add `MainCategoryDto` type and `getMainCategories` to `lib/queries.ts`**

Insert after `getCategory` (after line 298, before `getFilteredProducts`). Sort standard categories by `sortOrder` ascending (the schema field confirmed on `Category`, matching the pattern already used for `product.images.sort((a, b) => a.sortOrder - b.sortOrder)`), then append the `PROMOTIONAL` category (`acties`) last regardless of its own `sortOrder` value — the seed data sets it to `sortOrder: 0`, which would otherwise place it first. No try/catch, no empty-array fallback on error — this matches `getCategory`'s existing error behavior (let it throw).

Add `MainCategoryDto` next to `CategoryDto` (around line 48-54):

```typescript
export type MainCategoryDto = {
  id: string;
  slug: string;
  name: string;
};
```

Add the query function after `getCategory`:

```typescript
export async function getMainCategories(locale: Locale): Promise<MainCategoryDto[]> {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    include: { translations: true },
    orderBy: { sortOrder: "asc" },
  });

  const standard = categories.filter((category) => category.type !== "PROMOTIONAL");
  const promotional = categories.filter((category) => category.type === "PROMOTIONAL");

  return [...standard, ...promotional]
    .map((category) => {
      const translation = resolveTranslation(category.translations, locale);

      if (!translation) {
        return undefined;
      }

      return {
        id: category.id,
        slug: translation.slug,
        name: translation.name,
      };
    })
    .filter((category): category is MainCategoryDto => category !== undefined);
}
```

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors. `CategoryType` enum comparison (`"PROMOTIONAL"`) must match the Prisma-generated enum — confirm by checking `prisma/schema.prisma` for the `CategoryType` enum values if this fails.

- [ ] **Step 3: Document in `docs/ARCHITECTURE.md`**

Add a new section (after the existing "Build-time static params without a database" section, before "Sitemap size"):

```markdown
## Main category navigation ordering

`getMainCategories` in `lib/queries.ts` returns every active category for
header navigation, ordered by the `sortOrder` field on `Category` ascending,
with the `PROMOTIONAL` category (`acties`) always appended last regardless
of its own `sortOrder` value. The seed data assigns `acties` a `sortOrder`
of `0`, which would otherwise sort it first; the query separates standard
and promotional categories before concatenating them so the promotional
entry's position in the list is independent of its sort value.
```

- [ ] **Step 4: Commit**

```bash
git add lib/queries.ts docs/ARCHITECTURE.md
git commit -m "feat: add getMainCategories query for header navigation"
```

---

## Task 6: `lib/alternates.ts` — single source of truth for cross-locale URLs

**Files:**
- Create: `lib/alternates.ts`
- Modify: `docs/ARCHITECTURE.md`

**Interfaces:**
- Consumes: `Locale`, `locales` from `lib/i18n.ts`; `home`, `category`, `product`, `categories`, `articles`, `article`, `cart`, `account` from `lib/routes.ts`; `pagePath`, `PageKey` from `lib/pages.ts`; `getCategory`, `getProductBySlug`, `getArticleBySlug` from `lib/queries.ts` (all already exist).
- Produces: `export type AlternatesResult = { canonical: string; languages: Partial<Record<Locale, string>> }` and `export const getAlternates = cache(async (locale: Locale, kind: AlternateKind): Promise<AlternatesResult | undefined> => ...)`, where `AlternateKind` is a discriminated union covering category/product/page/article/fixed routes. Consumed by Task 9 (`Header`/layout), Task 10 (`LocaleSwitcher` prop), and Tasks 13-14 (page `generateMetadata`).

- [ ] **Step 1: Design the `AlternateKind` discriminant**

Each route type needs a different lookup: category/product/article need a slug to find `slugsByLocale`; pages need a `PageKey` (already locale-agnostic, resolved via `pageSlugs` directly — no DB lookup needed); fixed routes (`home`, `categories`, `cart`, `account`, `articles`) need no lookup at all since `lib/segments.ts` already has every locale's segment.

```typescript
import { cache } from "react";
import { locales, type Locale } from "@/lib/i18n";
import {
  account,
  article,
  articles,
  cart,
  categories,
  category,
  home,
  product,
} from "@/lib/routes";
import { pagePath, type PageKey } from "@/lib/pages";
import { getCategory, getProductBySlug, getArticleBySlug } from "@/lib/queries";

export type AlternateKind =
  | { type: "home" }
  | { type: "categories" }
  | { type: "cart" }
  | { type: "account" }
  | { type: "articles" }
  | { type: "category"; slug: string }
  | { type: "product"; slug: string }
  | { type: "article"; slug: string }
  | { type: "page"; key: PageKey };

export type AlternatesResult = {
  canonical: string;
  languages: Partial<Record<Locale, string>>;
};
```

- [ ] **Step 2: Implement `getAlternates` wrapped in React `cache`**

For fixed routes, build the language map directly from `lib/routes.ts` helpers (no DB call — every locale is guaranteed to have that route). For `category`/`product`/`article`, call the existing query for the *current* locale's slug to obtain `slugsByLocale`, then map it through the corresponding `lib/routes.ts` path helper. For `page`, use `pagePath` directly per locale (no DB call — `pageSlugs` is a static locale-agnostic map already).

```typescript
export const getAlternates = cache(
  async (locale: Locale, kind: AlternateKind): Promise<AlternatesResult | undefined> => {
    switch (kind.type) {
      case "home":
        return {
          canonical: home(locale),
          languages: Object.fromEntries(locales.map((loc) => [loc, home(loc)])),
        };
      case "categories":
        return {
          canonical: categories(locale),
          languages: Object.fromEntries(locales.map((loc) => [loc, categories(loc)])),
        };
      case "cart":
        return {
          canonical: cart(locale),
          languages: Object.fromEntries(locales.map((loc) => [loc, cart(loc)])),
        };
      case "account":
        return {
          canonical: account(locale),
          languages: Object.fromEntries(locales.map((loc) => [loc, account(loc)])),
        };
      case "articles":
        return {
          canonical: articles(locale),
          languages: Object.fromEntries(locales.map((loc) => [loc, articles(loc)])),
        };
      case "page":
        return {
          canonical: pagePath(kind.key, locale),
          languages: Object.fromEntries(
            locales.map((loc) => [loc, pagePath(kind.key, loc)])
          ),
        };
      case "category": {
        const data = await getCategory(kind.slug, locale);

        if (!data) {
          return undefined;
        }

        return {
          canonical: category(locale, data.slug),
          languages: Object.fromEntries(
            locales.flatMap((loc) => {
              const slug = data.slugsByLocale[loc];
              return slug ? [[loc, category(loc, slug)] as const] : [];
            })
          ),
        };
      }
      case "product": {
        const data = await getProductBySlug(kind.slug, locale);

        if (!data) {
          return undefined;
        }

        return {
          canonical: product(locale, data.slug),
          languages: Object.fromEntries(
            locales.flatMap((loc) => {
              const slug = data.slugsByLocale[loc];
              return slug ? [[loc, product(loc, slug)] as const] : [];
            })
          ),
        };
      }
      case "article": {
        const data = await getArticleBySlug(kind.slug, locale);

        if (!data) {
          return undefined;
        }

        return {
          canonical: article(locale, data.slug),
          languages: { [locale]: article(locale, data.slug) },
        };
      }
    }
  }
);
```

Note on `article`: `getArticleBySlug`'s `ArticleDetailDto` (via `ArticleSummaryDto`) does not currently expose a `slugsByLocale` field (unlike product/category). Only the current locale's own canonical URL can be produced without a broader query change, so `languages` includes only the requesting locale. This is a real, documented limitation — call it out in Step 4, not silently patched over.

- [ ] **Step 3: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors. If `CategoryType`/DTO field names mismatch, fix against the actual `lib/queries.ts` exports read in Task 5.

- [ ] **Step 4: Document in `docs/ARCHITECTURE.md`**

Add a new section:

```markdown
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
```

- [ ] **Step 5: Commit**

```bash
git add lib/alternates.ts docs/ARCHITECTURE.md
git commit -m "feat: add lib/alternates.ts as single source of truth for cross-locale URLs"
```

---

## Task 7: Dictionary copy keys

**Files:**
- Modify: `dictionaries/nl.json`
- Modify: `dictionaries/en.json`
- Modify: `dictionaries/fr.json`

**Interfaces:**
- Consumes: nothing.
- Produces: `dictionary.brand.baseline`, `dictionary.brand.logoMarkAlt`, `dictionary.brand.logoWordmarkAlt`, `dictionary.nav.skipToContent`, `dictionary.footer.terms`, `dictionary.footer.privacy`, `dictionary.footer.cookies`, `dictionary.footer.withdrawal`, `dictionary.footer.contact`, `dictionary.footer.subscribe`, `dictionary.footer.optOut` — consumed by Task 8 (layout skip-link), Task 9 (Logo alt text via Header), Task 11 (Footer).

- [ ] **Step 1: Add keys to `dictionaries/nl.json`**

Add a new top-level `brand` object and extend `nav`/`footer`:

```json
{
  "nav": {
    "home": "Home",
    "categories": "Assortiment",
    "cart": "Winkelwagen",
    "account": "Account",
    "articles": "Artikelen",
    "skipToContent": "Ga naar hoofdinhoud"
  },
  "brand": {
    "baseline": "Vers gebrande noten, gedroogde zuidvruchten",
    "logoMarkAlt": "De Notenman beeldmerk",
    "logoWordmarkAlt": "De Notenman"
  },
  "footer": {
    "aboutTitle": "Over ons",
    "contactTitle": "Contact",
    "legalTitle": "Juridisch",
    "copyright": "Alle rechten voorbehouden.",
    "terms": "Algemene voorwaarden",
    "privacy": "Privacybeleid",
    "cookies": "Cookiebeleid",
    "withdrawal": "Herroepingsrecht",
    "contact": "Contact",
    "subscribe": "Aanmelden nieuwsbrief",
    "optOut": "Afmelden nieuwsbrief"
  },
  "product": {
    "addToCart": "In winkelwagen",
    "outOfStock": "Niet op voorraad",
    "price": "Prijs",
    "pricePerHundredGrams": "per 100 g"
  },
  "cart": {
    "title": "Winkelwagen",
    "empty": "Nog niets in je winkelwagen.",
    "checkout": "Afrekenen",
    "total": "Totaal"
  },
  "category": {
    "filters": "Filters",
    "noResults": "Geen producten gevonden."
  },
  "common": {
    "loading": "Laden...",
    "search": "Zoeken"
  }
}
```

- [ ] **Step 2: Add keys to `dictionaries/en.json`**

Same structure, English copy:

```json
{
  "nav": {
    "home": "Home",
    "categories": "Collections",
    "cart": "Cart",
    "account": "Account",
    "articles": "Articles",
    "skipToContent": "Skip to main content"
  },
  "brand": {
    "baseline": "Freshly roasted nuts, dried fruit",
    "logoMarkAlt": "De Notenman logomark",
    "logoWordmarkAlt": "De Notenman"
  },
  "footer": {
    "aboutTitle": "About us",
    "contactTitle": "Contact",
    "legalTitle": "Legal",
    "copyright": "All rights reserved.",
    "terms": "Terms and conditions",
    "privacy": "Privacy policy",
    "cookies": "Cookie policy",
    "withdrawal": "Right of withdrawal",
    "contact": "Contact",
    "subscribe": "Newsletter signup",
    "optOut": "Newsletter opt-out"
  },
  "product": {
    "addToCart": "Add to cart",
    "outOfStock": "Out of stock",
    "price": "Price",
    "pricePerHundredGrams": "per 100 g"
  },
  "cart": {
    "title": "Cart",
    "empty": "Your cart is empty.",
    "checkout": "Checkout",
    "total": "Total"
  },
  "category": {
    "filters": "Filters",
    "noResults": "No products found."
  },
  "common": {
    "loading": "Loading...",
    "search": "Search"
  }
}
```

- [ ] **Step 3: Add keys to `dictionaries/fr.json`**

Same structure, French copy:

```json
{
  "nav": {
    "home": "Accueil",
    "categories": "Collections",
    "cart": "Panier",
    "account": "Compte",
    "articles": "Articles",
    "skipToContent": "Aller au contenu principal"
  },
  "brand": {
    "baseline": "Noix fraîchement torréfiées, fruits secs",
    "logoMarkAlt": "Emblème De Notenman",
    "logoWordmarkAlt": "De Notenman"
  },
  "footer": {
    "aboutTitle": "À propos",
    "contactTitle": "Contact",
    "legalTitle": "Mentions légales",
    "copyright": "Tous droits réservés.",
    "terms": "Conditions générales",
    "privacy": "Politique de confidentialité",
    "cookies": "Politique de cookies",
    "withdrawal": "Droit de rétractation",
    "contact": "Contact",
    "subscribe": "Inscription newsletter",
    "optOut": "Désinscription newsletter"
  },
  "product": {
    "addToCart": "Ajouter au panier",
    "outOfStock": "Rupture de stock",
    "price": "Prix",
    "pricePerHundredGrams": "par 100 g"
  },
  "cart": {
    "title": "Panier",
    "empty": "Votre panier est vide.",
    "checkout": "Commander",
    "total": "Total"
  },
  "category": {
    "filters": "Filtres",
    "noResults": "Aucun produit trouvé."
  },
  "common": {
    "loading": "Chargement...",
    "search": "Rechercher"
  }
}
```

- [ ] **Step 4: Verify JSON validity**

Run: `node -e "JSON.parse(require('fs').readFileSync('dictionaries/nl.json','utf8')); JSON.parse(require('fs').readFileSync('dictionaries/en.json','utf8')); JSON.parse(require('fs').readFileSync('dictionaries/fr.json','utf8')); console.log('ok')"`
Expected: `ok`

- [ ] **Step 5: Commit**

```bash
git add dictionaries/nl.json dictionaries/en.json dictionaries/fr.json
git commit -m "feat: add brand baseline, skip-link and footer legal copy keys"
```

---

## Task 8: Fonts and root layout typography scaffold

**Files:**
- Modify: `app/[locale]/layout.tsx`

**Interfaces:**
- Consumes: `app/globals.css` (Task 3), dictionary `nav.skipToContent` (Task 7).
- Produces: `<html>` carries `--font-dosis`/`--font-montserrat` CSS variables and base typography classes, consumed visually by every page. This task only adds fonts/base typography/skip-link — Header/Footer wiring happens in Task 9/11 once those components exist, to keep this task's diff reviewable on its own.

- [ ] **Step 1: Import `next/font/google` fonts and `globals.css`, add skip-link**

Modify `app/[locale]/layout.tsx`. Add font setup at module scope, import `./../globals.css` (relative path from `app/[locale]/` — this file is not in the `next.config.ts` import chain so `@/` alias is fine, but stay consistent with existing `@/lib/...` imports already in this file), and add a skip-link plus base typography classes on `<body>`:

```typescript
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Dosis, Montserrat } from "next/font/google";
import { locales, isLocale } from "@/lib/i18n";
import { account, articles, cart, categories, home } from "@/lib/routes";
import nl from "@/dictionaries/nl.json";
import en from "@/dictionaries/en.json";
import fr from "@/dictionaries/fr.json";
import "@/app/globals.css";

const dosis = Dosis({
  subsets: ["latin"],
  variable: "--font-dosis",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
});

const dictionaries = { nl, en, fr };

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  await params;

  return {
    alternates: {
      languages: Object.fromEntries(
        locales.map((loc) => [loc, `/${loc}`])
      ),
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;

  if (!isLocale(rawLocale)) {
    notFound();
  }

  const locale = rawLocale;
  const dictionary = dictionaries[locale];

  return (
    <html lang={locale} className={`${dosis.variable} ${montserrat.variable}`}>
      <body className="bg-background font-body text-text">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-accent focus:px-4 focus:py-2 focus:text-text"
        >
          {dictionary.nav.skipToContent}
        </a>
        <header>
          <nav>
            <a href={home(locale)}>{dictionary.nav.home}</a>
            <a href={categories(locale)}>{dictionary.nav.categories}</a>
            <a href={articles(locale)}>{dictionary.nav.articles}</a>
            <a href={cart(locale)}>{dictionary.nav.cart}</a>
            <a href={account(locale)}>{dictionary.nav.account}</a>
          </nav>
        </header>
        <main id="main-content">{children}</main>
        <footer>
          <p>{dictionary.footer.aboutTitle}</p>
          <p>{dictionary.footer.contactTitle}</p>
          <p>{dictionary.footer.legalTitle}</p>
          <p>{dictionary.footer.copyright}</p>
        </footer>
      </body>
    </html>
  );
}
```

This step intentionally keeps the existing raw `<header>`/`<footer>` markup in place — Task 9 and Task 11 replace them with the real `Header`/`Footer` components once those exist, and Task 13 replaces the `generateMetadata` alternates with `lib/alternates.ts`. Splitting it this way keeps each task's diff independently reviewable.

- [ ] **Step 2: Verify types and font loading**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/[locale]/layout.tsx
git commit -m "feat: wire Dosis/Montserrat variable fonts and skip-link into root layout"
```

---

## Task 9: `Container` and `Logo` components

**Files:**
- Create: `components/ui/Container.tsx`
- Create: `components/ui/Logo.tsx`

**Interfaces:**
- Consumes: `cn` from `lib/cn.ts` (Task 4).
- Produces: `<Container>` (props: `children: React.ReactNode`, `className?: string`) consumed by every page task; `<Logo>` (props: `alt: { mark: string; wordmark: string }`, `className?: string`) consumed by Task 10 (`Header`).

- [ ] **Step 1: Create `components/ui/Container.tsx`**

```tsx
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Container({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8", className)}>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Create `components/ui/Logo.tsx`**

Renders both the mark and wordmark from `public/brand/logo-mark.svg` and `public/brand/logo-wordmark.svg`. If those files don't exist yet, `next/image` (or a plain `<img>`) pointing at a missing local file 404s at the network level but does not throw a render error or crash the page — so no placeholder image is generated, per the task. Use plain `<img>` (not `next/image`) since these are static local SVGs with no need for the optimization pipeline, and `next/image` requires a real file to determine intrinsic size at build time for local imports, which would fail the build if the asset is absent.

```tsx
import { cn } from "@/lib/cn";

export function Logo({
  alt,
  className,
}: {
  alt: { mark: string; wordmark: string };
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <img src="/brand/logo-mark.svg" alt={alt.mark} className="h-8 w-8" />
      <img src="/brand/logo-wordmark.svg" alt={alt.wordmark} className="h-6" />
    </span>
  );
}
```

- [ ] **Step 3: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/ui/Container.tsx components/ui/Logo.tsx
git commit -m "feat: add Container and Logo primitives"
```

---

## Task 10: `LocaleSwitcher` client component

**Files:**
- Create: `components/layout/LocaleSwitcher.tsx`

**Interfaces:**
- Consumes: `Locale`, `locales` from `lib/i18n.ts`; `home` from `lib/routes.ts`; `cn` from `lib/cn.ts`.
- Produces: `<LocaleSwitcher currentLocale={Locale} languages={Partial<Record<Locale, string>>} />` — a client component receiving pre-resolved alternates as a prop (produced by `lib/alternates.ts` in the parent server component), consumed by Task 11 (`Header`).

- [ ] **Step 1: Create `components/layout/LocaleSwitcher.tsx`**

This is the one component allowed to be a client component (needs `usePathname`-free simple link rendering — actually no client hook is strictly required since it just renders `<a>` tags from props, but per the task spec this is explicitly designated as the client component, so mark it `"use client"` to match that requirement even though its current implementation has no interactive state). It does no route or slug construction — everything comes from the `languages` prop, with a fallback to that locale's homepage when a translation is missing:

```tsx
"use client";

import { locales, type Locale } from "@/lib/i18n";
import { home } from "@/lib/routes";
import { cn } from "@/lib/cn";

export function LocaleSwitcher({
  currentLocale,
  languages,
}: {
  currentLocale: Locale;
  languages: Partial<Record<Locale, string>>;
}) {
  return (
    <ul className="flex items-center gap-2">
      {locales.map((locale) => {
        const href = languages[locale] ?? home(locale);

        return (
          <li key={locale}>
            <a
              href={href}
              aria-current={locale === currentLocale ? "true" : undefined}
              className={cn(
                "text-sm uppercase text-muted hover:text-text",
                locale === currentLocale && "text-text font-semibold"
              )}
            >
              {locale}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/layout/LocaleSwitcher.tsx
git commit -m "feat: add LocaleSwitcher client component reading alternates from props"
```

---

## Task 11: `Header` and `Footer` components

**Files:**
- Create: `components/layout/Header.tsx`
- Create: `components/layout/Footer.tsx`

**Interfaces:**
- Consumes: `Logo` (Task 9), `LocaleSwitcher` (Task 10), `Container` (Task 9), `getMainCategories` (Task 5), `home`/`categories`/`articles`/`cart`/`account`/`category` from `lib/routes.ts`, `pagePath` from `lib/pages.ts`, dictionary shape from Task 7.
- Produces: `<Header locale={Locale} dictionary={Dictionary} languages={Partial<Record<Locale,string>>} />` and `<Footer locale={Locale} dictionary={Dictionary} />`, both consumed by Task 13 (`app/[locale]/layout.tsx`). `Dictionary` here means the imported JSON shape (`typeof nl`), not a new type — import it as `import nl from "@/dictionaries/nl.json"` and use `typeof nl` inline, matching how `layout.tsx` already imports dictionaries.

- [ ] **Step 1: Create `components/layout/Header.tsx`**

Server component. Fetches main categories via the existing query, links to fixed routes via `lib/routes.ts`, renders `Logo` and `LocaleSwitcher`:

```tsx
import type nl from "@/dictionaries/nl.json";
import type { Locale } from "@/lib/i18n";
import { account, articles, cart, categories, category, home } from "@/lib/routes";
import { getMainCategories } from "@/lib/queries";
import { Container } from "@/components/ui/Container";
import { Logo } from "@/components/ui/Logo";
import { LocaleSwitcher } from "@/components/layout/LocaleSwitcher";

export async function Header({
  locale,
  dictionary,
  languages,
}: {
  locale: Locale;
  dictionary: typeof nl;
  languages: Partial<Record<Locale, string>>;
}) {
  const mainCategories = await getMainCategories(locale);

  return (
    <header className="border-b border-border bg-background">
      <Container className="flex items-center justify-between py-4">
        <a href={home(locale)}>
          <Logo
            alt={{ mark: dictionary.brand.logoMarkAlt, wordmark: dictionary.brand.logoWordmarkAlt }}
          />
        </a>
        <nav aria-label={dictionary.nav.categories}>
          <ul className="flex items-center gap-6">
            {mainCategories.map((item) => (
              <li key={item.id}>
                <a href={category(locale, item.slug)} className="hover:text-accent-hover">
                  {item.name}
                </a>
              </li>
            ))}
            <li>
              <a href={categories(locale)} className="hover:text-accent-hover">
                {dictionary.nav.categories}
              </a>
            </li>
            <li>
              <a href={articles(locale)} className="hover:text-accent-hover">
                {dictionary.nav.articles}
              </a>
            </li>
            <li>
              <a href={cart(locale)} className="hover:text-accent-hover">
                {dictionary.nav.cart}
              </a>
            </li>
            <li>
              <a href={account(locale)} className="hover:text-accent-hover">
                {dictionary.nav.account}
              </a>
            </li>
          </ul>
        </nav>
        <LocaleSwitcher currentLocale={locale} languages={languages} />
      </Container>
    </header>
  );
}
```

- [ ] **Step 2: Create `components/layout/Footer.tsx`**

Server component on the contrast band, wordmark, legal links via `pagePath`, plus contact/subscribe/opt-out:

```tsx
import type nl from "@/dictionaries/nl.json";
import type { Locale } from "@/lib/i18n";
import { pagePath } from "@/lib/pages";
import { Container } from "@/components/ui/Container";
import { Logo } from "@/components/ui/Logo";

export function Footer({
  locale,
  dictionary,
}: {
  locale: Locale;
  dictionary: typeof nl;
}) {
  return (
    <footer className="bg-contrast text-background">
      <Container className="flex flex-col gap-6 py-10">
        <Logo
          alt={{ mark: dictionary.brand.logoMarkAlt, wordmark: dictionary.brand.logoWordmarkAlt }}
        />
        <nav aria-label={dictionary.footer.legalTitle}>
          <ul className="flex flex-wrap gap-4 text-sm">
            <li>
              <a href={pagePath("terms", locale)}>{dictionary.footer.terms}</a>
            </li>
            <li>
              <a href={pagePath("privacy", locale)}>{dictionary.footer.privacy}</a>
            </li>
            <li>
              <a href={pagePath("cookies", locale)}>{dictionary.footer.cookies}</a>
            </li>
            <li>
              <a href={pagePath("withdrawal", locale)}>{dictionary.footer.withdrawal}</a>
            </li>
            <li>
              <a href={pagePath("contact", locale)}>{dictionary.footer.contact}</a>
            </li>
            <li>
              <a href={pagePath("subscribe", locale)}>{dictionary.footer.subscribe}</a>
            </li>
            <li>
              <a href={pagePath("optOut", locale)}>{dictionary.footer.optOut}</a>
            </li>
          </ul>
        </nav>
        <p className="text-sm text-background/70">{dictionary.footer.copyright}</p>
      </Container>
    </footer>
  );
}
```

- [ ] **Step 3: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/layout/Header.tsx components/layout/Footer.tsx
git commit -m "feat: add Header and Footer components"
```

---

## Task 12: `ProductCard` component

**Files:**
- Create: `components/product/ProductCard.tsx`

**Interfaces:**
- Consumes: `ProductSummaryDto` from `lib/queries.ts`; `formatPrice` from `lib/format.ts`; `product` route helper from `lib/routes.ts`; `cn` from `lib/cn.ts`.
- Produces: `<ProductCard product={ProductSummaryDto} categoryName={string} locale={Locale} />`, consumed by Task 14/15 (homepage and category pages).

- [ ] **Step 1: Create `components/product/ProductCard.tsx`**

Renders name, category, price via `formatPrice`, on the white surface. Missing image renders a neutral placeholder block, not a broken `<img>`. Does not build its own image URL — `ProductSummaryDto.images[].url` already comes from the existing `publicImageUrl` storage helper via `toProductImageDto` in `lib/queries.ts`, so this component only reads `.url`, never constructs one:

```tsx
import type { Locale } from "@/lib/i18n";
import type { ProductSummaryDto } from "@/lib/queries";
import { product as productPath } from "@/lib/routes";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/cn";

export function ProductCard({
  product,
  categoryName,
  locale,
}: {
  product: ProductSummaryDto;
  categoryName: string;
  locale: Locale;
}) {
  const primaryImage = product.images.find((image) => image.isPrimary) ?? product.images[0];

  return (
    <a
      href={productPath(locale, product.slug)}
      className="block rounded-lg border border-border bg-surface p-4 transition hover:shadow-md"
    >
      {primaryImage ? (
        <img
          src={primaryImage.url}
          alt={primaryImage.alt ?? product.name}
          className="aspect-square w-full rounded object-cover"
        />
      ) : (
        <div
          className={cn("aspect-square w-full rounded bg-background")}
          role="img"
          aria-label={product.name}
        />
      )}
      <p className="mt-3 text-sm text-muted">{categoryName}</p>
      <h3 className="font-heading text-lg tracking-heading text-text">{product.name}</h3>
      <p className="mt-1 font-semibold text-text">{formatPrice(product.basePriceCents, locale)}</p>
    </a>
  );
}
```

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/product/ProductCard.tsx
git commit -m "feat: add ProductCard component"
```

---

## Task 13: Wire Header/Footer/alternates into root layout

**Files:**
- Modify: `app/[locale]/layout.tsx`

**Interfaces:**
- Consumes: `Header`/`Footer` (Task 11), `getAlternates` (Task 6).
- Produces: final root layout shape, consumed visually by all pages.

- [ ] **Step 1: Replace raw header/footer markup with components, replace inline alternates with `lib/alternates.ts`**

```typescript
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Dosis, Montserrat } from "next/font/google";
import { isLocale } from "@/lib/i18n";
import { getAlternates } from "@/lib/alternates";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import nl from "@/dictionaries/nl.json";
import en from "@/dictionaries/en.json";
import fr from "@/dictionaries/fr.json";
import "@/app/globals.css";

const dosis = Dosis({
  subsets: ["latin"],
  variable: "--font-dosis",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
});

const dictionaries = { nl, en, fr };

export async function generateStaticParams() {
  const { locales } = await import("@/lib/i18n");
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;

  if (!isLocale(rawLocale)) {
    return {};
  }

  const alternates = await getAlternates(rawLocale, { type: "home" });

  if (!alternates) {
    return {};
  }

  return {
    alternates: {
      canonical: alternates.canonical,
      languages: alternates.languages,
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;

  if (!isLocale(rawLocale)) {
    notFound();
  }

  const locale = rawLocale;
  const dictionary = dictionaries[locale];
  const alternates = await getAlternates(locale, { type: "home" });

  return (
    <html lang={locale} className={`${dosis.variable} ${montserrat.variable}`}>
      <body className="bg-background font-body text-text">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-accent focus:px-4 focus:py-2 focus:text-text"
        >
          {dictionary.nav.skipToContent}
        </a>
        <Header locale={locale} dictionary={dictionary} languages={alternates?.languages ?? {}} />
        <main id="main-content">{children}</main>
        <Footer locale={locale} dictionary={dictionary} />
      </body>
    </html>
  );
}
```

Note: reverted the top-level `generateStaticParams` back to a static import of `locales` rather than the dynamic `await import(...)` shown as a placeholder above — dynamic import here would be an unmotivated deviation from the existing pattern. Use:

```typescript
import { locales, isLocale } from "@/lib/i18n";
```

at the top instead, and a plain `export function generateStaticParams() { return locales.map((locale) => ({ locale })); }` unchanged from the original file.

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/[locale]/layout.tsx
git commit -m "feat: wire Header, Footer and single-source alternates into root layout"
```

---

## Task 14: Homepage and categories pages use `ProductCard` + `Container`

**Files:**
- Modify: `app/[locale]/page.tsx`
- Modify: `app/[locale]/categories/page.tsx`

**Interfaces:**
- Consumes: `ProductCard` (Task 12), `Container` (Task 9). Query logic (`getFilteredProducts`) stays exactly as-is per the task constraint — no changes to data flow.

- [ ] **Step 1: Update `app/[locale]/page.tsx`**

`ProductCard` needs a `categoryName` per product; `getFilteredProducts("all", ...)` doesn't return category info per product, so pass an empty string is wrong — instead, since this is the homepage showing all products without a specific category context, pass the product's own name context is unavailable too. Re-check: `ProductSummaryDto` has no category field. Use the dictionary's `nav.categories` label as a generic category fallback is misleading. The correct minimal fix: change `ProductCard`'s `categoryName` prop to optional, since not every listing context has one to hand.

Go back and adjust `components/product/ProductCard.tsx` from Task 12: make `categoryName` optional (`categoryName?: string`) and only render the `<p>` when present. This is a same-task correction to Task 12's interface, applied now because this is where the mismatch surfaces — update the component file:

```tsx
{categoryName ? <p className="mt-3 text-sm text-muted">{categoryName}</p> : null}
```

and the prop type:

```tsx
export function ProductCard({
  product,
  categoryName,
  locale,
}: {
  product: ProductSummaryDto;
  categoryName?: string;
  locale: Locale;
}) {
```

Then `app/[locale]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { locales, isLocale } from "@/lib/i18n";
import { getFilteredProducts } from "@/lib/queries";
import { Container } from "@/components/ui/Container";
import { ProductCard } from "@/components/product/ProductCard";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;

  if (!isLocale(rawLocale)) {
    notFound();
  }

  const locale = rawLocale;
  const products = await getFilteredProducts("all", locale, []);

  return (
    <Container className="py-10">
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((item) => (
          <ProductCard key={item.id} product={item} locale={locale} />
        ))}
      </div>
    </Container>
  );
}
```

- [ ] **Step 2: Update `app/[locale]/categories/page.tsx`** (same shape, this route lists all products too per its current implementation)

```tsx
import { notFound } from "next/navigation";
import { locales, isLocale } from "@/lib/i18n";
import { getFilteredProducts } from "@/lib/queries";
import { Container } from "@/components/ui/Container";
import { ProductCard } from "@/components/product/ProductCard";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function CategoriesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;

  if (!isLocale(rawLocale)) {
    notFound();
  }

  const locale = rawLocale;
  const products = await getFilteredProducts("all", locale, []);

  return (
    <Container className="py-10">
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((item) => (
          <ProductCard key={item.id} product={item} locale={locale} />
        ))}
      </div>
    </Container>
  );
}
```

- [ ] **Step 3: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/[locale]/page.tsx app/[locale]/categories/page.tsx components/product/ProductCard.tsx
git commit -m "feat: use ProductCard and Container on homepage and categories listing"
```

---

## Task 15: Category detail page uses `ProductCard` + alternates

**Files:**
- Modify: `app/[locale]/categories/[category]/page.tsx`

**Interfaces:**
- Consumes: `ProductCard` (Task 12, now with optional `categoryName`), `Container` (Task 9), `getAlternates` (Task 6).

- [ ] **Step 1: Replace inline alternates and raw markup**

Here `categoryName` IS available (`data.name`), so pass it explicitly:

```tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { locales, isLocale } from "@/lib/i18n";
import { getCategory, getCategorySlugs } from "@/lib/queries";
import { getAlternates } from "@/lib/alternates";
import { Container } from "@/components/ui/Container";
import { ProductCard } from "@/components/product/ProductCard";

export async function generateStaticParams() {
  const params = await Promise.all(
    locales.map(async (locale) => {
      const entries = await getCategorySlugs(locale);
      return entries.map((entry) => ({ locale, category: entry.slug }));
    })
  );

  return params.flat();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; category: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale, category } = await params;

  if (!isLocale(rawLocale)) {
    return {};
  }

  const alternates = await getAlternates(rawLocale, { type: "category", slug: category });

  if (!alternates) {
    return {};
  }

  return {
    alternates: {
      canonical: alternates.canonical,
      languages: alternates.languages,
    },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ locale: string; category: string }>;
}) {
  const { locale: rawLocale, category } = await params;

  if (!isLocale(rawLocale)) {
    notFound();
  }

  const locale = rawLocale;
  const data = await getCategory(category, locale);

  if (!data) {
    notFound();
  }

  return (
    <Container className="py-10">
      <h1 className="font-heading text-3xl tracking-heading text-text">{data.name}</h1>
      <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
        {data.products.map((item) => (
          <ProductCard key={item.id} product={item} categoryName={data.name} locale={locale} />
        ))}
      </div>
    </Container>
  );
}
```

Note: `getAlternates` for `"category"` calls `getCategory` internally, and this page also calls `getCategory` directly — both calls use the same `category`/`locale` arguments, but `getAlternates` is wrapped in `cache()` while the direct `getCategory` call in the page body is not deduplicated against it (different function identity: `getCategory` vs `getAlternates`). This is an accepted minor duplication, not a bug — the plan's `cache()` requirement (from the user's decision) applies to `getAlternates` deduplicating across `generateMetadata` and *itself*, not to deduplicating unrelated call sites that happen to fetch overlapping data. Do not attempt to merge these calls; that would be unrequested scope creep.

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/[locale]/categories/[category]/page.tsx
git commit -m "feat: use ProductCard, Container and shared alternates on category detail page"
```

---

## Task 16: Product detail page — `Container`/typography + alternates

**Files:**
- Modify: `app/[locale]/products/[product]/page.tsx`

**Interfaces:**
- Consumes: `Container` (Task 9), `getAlternates` (Task 6). No `ProductCard` here — this is a detail page, not a listing (task step 24 only requires `ProductCard` on homepage and category pages).

- [ ] **Step 1: Replace inline alternates, add `Container`/typography only (no new functionality)**

```tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { locales, isLocale } from "@/lib/i18n";
import { getProductBySlug, getProductSlugs } from "@/lib/queries";
import { getAlternates } from "@/lib/alternates";
import { Container } from "@/components/ui/Container";

export async function generateStaticParams() {
  const params = await Promise.all(
    locales.map(async (locale) => {
      const entries = await getProductSlugs(locale);
      return entries.map((entry) => ({ locale, product: entry.slug }));
    })
  );

  return params.flat();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; product: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale, product } = await params;

  if (!isLocale(rawLocale)) {
    return {};
  }

  const alternates = await getAlternates(rawLocale, { type: "product", slug: product });

  if (!alternates) {
    return {};
  }

  return {
    alternates: {
      canonical: alternates.canonical,
      languages: alternates.languages,
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: string; product: string }>;
}) {
  const { locale: rawLocale, product } = await params;

  if (!isLocale(rawLocale)) {
    notFound();
  }

  const locale = rawLocale;
  const data = await getProductBySlug(product, locale);

  if (!data) {
    notFound();
  }

  return (
    <Container className="py-10">
      <h1 className="font-heading text-3xl tracking-heading text-text">{data.name}</h1>
      <p className="mt-4 text-text">{data.description}</p>
    </Container>
  );
}
```

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/[locale]/products/[product]/page.tsx
git commit -m "feat: use Container, typography and shared alternates on product detail page"
```

---

## Task 17: Content pages, cart, account, articles — `Container`/typography only

**Files:**
- Modify: `app/[locale]/pages/[slug]/page.tsx`
- Modify: `app/[locale]/cart/page.tsx`
- Modify: `app/[locale]/account/page.tsx`
- Modify: `app/[locale]/blogs/articles/page.tsx`
- Modify: `app/[locale]/blogs/articles/[slug]/page.tsx`

**Interfaces:**
- Consumes: `Container` (Task 9), `getAlternates` (Task 6, for `pages/[slug]` and the new article `generateMetadata`).

- [ ] **Step 1: Update `app/[locale]/pages/[slug]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { locales, isLocale } from "@/lib/i18n";
import { pageKeys, pageSlugs, resolvePageKey } from "@/lib/pages";
import { getAlternates } from "@/lib/alternates";
import { Container } from "@/components/ui/Container";

export function generateStaticParams() {
  return locales.flatMap((locale) =>
    pageKeys.map((key) => ({ locale, slug: pageSlugs[key][locale] }))
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;

  if (!isLocale(rawLocale)) {
    return {};
  }

  const locale = rawLocale;
  const key = resolvePageKey(locale, slug);

  if (!key) {
    return {};
  }

  const alternates = await getAlternates(locale, { type: "page", key });

  if (!alternates) {
    return {};
  }

  return {
    alternates: {
      canonical: alternates.canonical,
      languages: alternates.languages,
    },
  };
}

export default async function ContentPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug } = await params;

  if (!isLocale(rawLocale)) {
    notFound();
  }

  const locale = rawLocale;
  const key = resolvePageKey(locale, slug);

  if (!key) {
    notFound();
  }

  return (
    <Container className="py-10">
      <article className="font-body text-text">{key}</article>
    </Container>
  );
}
```

- [ ] **Step 2: Update `app/[locale]/cart/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { Container } from "@/components/ui/Container";

export default async function CartPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return <Container className="py-10"></Container>;
}
```

- [ ] **Step 3: Update `app/[locale]/account/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { Container } from "@/components/ui/Container";

export default async function AccountPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return <Container className="py-10"></Container>;
}
```

- [ ] **Step 4: Update `app/[locale]/blogs/articles/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { Container } from "@/components/ui/Container";

export default async function ArticlesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return (
    <Container className="py-10">
      <ul></ul>
    </Container>
  );
}
```

- [ ] **Step 5: Update `app/[locale]/blogs/articles/[slug]/page.tsx`**

This page currently has no `generateMetadata` at all. Add one using `lib/alternates.ts`, consistent with every other translated-content route (per Task 6's design, which explicitly covers `"article"` as a kind):

```tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale } from "@/lib/i18n";
import { getAlternates } from "@/lib/alternates";
import { Container } from "@/components/ui/Container";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;

  if (!isLocale(locale)) {
    return {};
  }

  const alternates = await getAlternates(locale, { type: "article", slug });

  if (!alternates) {
    return {};
  }

  return {
    alternates: {
      canonical: alternates.canonical,
      languages: alternates.languages,
    },
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return (
    <Container className="py-10">
      <article className="font-body text-text">{slug}</article>
    </Container>
  );
}
```

- [ ] **Step 6: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add app/[locale]/pages/[slug]/page.tsx app/[locale]/cart/page.tsx app/[locale]/account/page.tsx app/[locale]/blogs/articles/page.tsx app/[locale]/blogs/articles/[slug]/page.tsx
git commit -m "feat: apply Container and typography across remaining pages, add article alternates"
```

---

## Task 18: `public/brand/` directory and documentation updates

**Files:**
- Create: `public/brand/.gitkeep` (only way to track an otherwise-empty directory in git; contains no prose, just an empty marker file — consistent with "no file may be authored with or reference any tool" since it has zero content)
- Modify: `docs/STRUCTURE.md`
- Modify: `docs/ARCHITECTURE.md`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing consumed by other tasks — final documentation task.

- [ ] **Step 1: Create the brand assets directory**

Git does not track empty directories. Create `public/brand/.gitkeep` (zero-byte file) so the directory exists in the repo for the user to drop `logo-mark.svg`/`logo-wordmark.svg` into later.

- [ ] **Step 2: Update `docs/STRUCTURE.md`**

Add these placement rules (insert after the existing "All React components live in `components/`..." line):

```markdown
- `components/ui/` holds framework-level primitives (`Container`, `Logo`)
  with no domain knowledge. `components/layout/` holds page-shell
  components (`Header`, `Footer`, `LocaleSwitcher`). `components/product/`
  holds product-domain components (`ProductCard`). `components/category/`
  is reserved for category-domain components, not yet populated.
- `public/brand/` holds brand assets (`logo-mark.svg`, `logo-wordmark.svg`)
  referenced by the `Logo` component. No other component reads from this
  directory directly.
- `lib/alternates.ts` is the only source for cross-locale URLs of any kind;
  no other file constructs one.
- Colors, fonts, and typographic scales are defined exclusively in the
  single `@theme` block in `app/globals.css`. No component or other CSS
  file defines a color or font token.
```

- [ ] **Step 3: Update `docs/ARCHITECTURE.md`**

Add a new section documenting the styling decision, accent rule, and library rationale (append near the end, after "Sitemap size"):

```markdown
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
```

- [ ] **Step 4: Commit**

```bash
git add public/brand/.gitkeep docs/STRUCTURE.md docs/ARCHITECTURE.md
git commit -m "docs: document component structure, brand assets and styling decisions"
```

---

## Task 19: Full verification

**Files:** none (verification only)

**Interfaces:** none.

- [ ] **Step 1: Type-check**

Run: `npx tsc --noEmit`
Expected: zero errors. If errors appear, fix them without casts (`as`) or `@ts-ignore`/`@ts-expect-error` suppressions — trace each error to the actual type mismatch (likely candidates: `CategoryType` enum literal in `getMainCategories`, `Dictionary` type inference from JSON imports, `AlternateKind` discriminated union narrowing in `lib/alternates.ts`).

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: build succeeds, including the `prisma generate` step now prefixed onto it (Task 1). If the build fails on a database connection during `generateStaticParams` (e.g., `getCategorySlugs`/`getProductSlugs`/`getArticleSlugs` — these already catch errors internally per `docs/ARCHITECTURE.md`'s existing "Build-time static params without a database" section, so this should degrade gracefully, not fail the build). If `getMainCategories` (Task 5, no try/catch per spec) throws during a build-time render of `Header` because the database is unreachable, that is an expected, spec-mandated failure mode — surface it to the user rather than silently adding a try/catch, since the task's constraints explicitly forbid masking page-query errors.

- [ ] **Step 3: Report results**

If both commands succeed cleanly, the phase is complete. If `npm run build` fails specifically because the database is unreachable (expected in a local dev environment without Cloud SQL/Neon connectivity configured for build-time), report that distinction clearly rather than treating it as a code defect — this matches the existing project pattern of degrading gracefully at the slug-list level while accepting that `getMainCategories` and other unwrapped queries require a live database connection at build or request time.

No commit for this task — it's verification-only. If fixes were required in Step 1 or Step 2, those fixes belong to whichever earlier task's file they touch; amend that task's commit is not appropriate per repo convention (always new commits) — create a small fixup commit instead:

```bash
git add -A
git commit -m "fix: resolve type/build errors found during phase 8 verification"
```

(Only run this if fixes were actually needed.)

---

## Self-Review Notes

- **Spec coverage:** All 28 numbered requirements plus both follow-up decisions (getMainCategories ordering/sourcing, lib/alternates.ts as single source of truth) map to a task above. `docs/CLOUD_SETUP.md` and `modules/`/`admin/` reservations are untouched, as required.
- **Placeholder scan:** No TBD/TODO markers. The one spot that looked like a placeholder (Task 13's dynamic-import aside) is resolved inline with the actual correct code, not left dangling.
- **Type consistency:** `ProductCard`'s `categoryName` prop is corrected from required to optional within Task 12/14 once the mismatch with homepage usage surfaces, and that correction is carried consistently into Task 15 (category detail, where it IS provided). `AlternatesResult`/`AlternateKind` names and shapes are identical across Task 6's definition and every consumer (Tasks 9, 10, 13, 15, 16, 17).
- **Known limitation carried forward, not hidden:** `getAlternates` for articles only returns the current locale in `languages`, documented in Task 6 Step 4 and left as a known gap rather than silently expanding `ArticleDetailDto`'s shape (which the original task did not authorize touching).
