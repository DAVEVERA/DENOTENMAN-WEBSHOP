# Phase 8b: Locale Switcher Route Awareness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the `LocaleSwitcher` always linking to the target locale's homepage instead of the translated equivalent of the current page, by extracting `Header`+`Footer` into a single `SiteShell` component and giving every top-level route under `app/[locale]/` its own thin `layout.tsx` that computes the correct `AlternateKind` from its own route params and renders `SiteShell` with the right alternates.

**Architecture:** React Server Components cannot pass data from a child route segment up into a shared ancestor layout at request time — this is a hard framework limitation, not an implementation gap (confirmed via research against Next.js 16 docs: layouts do not have access to a stable pathname API, and there is no context mechanism that flows child-to-parent across Server Components). The only idiomatic fix is to push the alternates computation down to the layout level that actually has the route params: Next.js supports a `layout.tsx` at every route segment, each independently scoped to its own `params`. `app/[locale]/layout.tsx` shrinks to pure document shell (html/body/fonts/skip-link/globals.css) and stops rendering `Header`/`Footer` itself. Every top-level route directory gets a `layout.tsx` that computes its own alternates (via the existing `cache()`-wrapped `getAlternates`) and renders `SiteShell`, which is the single place `Header` and `Footer` are composed together.

**Tech Stack:** Next.js 16.3.0 (App Router, nested layouts), React 19 `cache()`, existing `lib/alternates.ts`.

## Global Constraints

- `Header` and `Footer` are defined exactly once, inside a new `SiteShell` component. No layout builds its own header or footer markup — every layout renders `SiteShell` with the correct `languages` prop and nothing else header/footer-related.
- `app/[locale]/layout.tsx` keeps ONLY the document structure: `<html>`, `<body>`, font variable setup, the skip-link, and the `globals.css` import. It no longer renders `SiteShell`, `Header`, or `Footer`.
- Every top-level route under `app/[locale]/` gets a thin `layout.tsx` that renders `SiteShell`. For static routes (home, cart, account, categories-list, articles-list) the alternates come from `lib/segments.ts`-backed fixed-route kinds already in `AlternateKind` (`{type:"home"}`, `{type:"cart"}`, etc.) — no new lib/alternates.ts kinds needed for these. For the four dynamic route types (products/[product], categories/[category], pages/[slug], blogs/articles/[slug]) the alternates come from `getAlternates` called with the specific slug/key from that layout's own `params`.
- `getAlternates` is shared via React `cache()` so a layout and its sibling page's `generateMetadata` never hit the database twice for the same lookup in the same request. Do not change `getAlternates`'s signature or `lib/alternates.ts`'s exported surface — this plan only adds new call sites.
- `Header` and `LocaleSwitcher`'s component interfaces do not change. Only the origin of the `languages` prop moves from the root layout to the most specific nested layout that applies.
- No file may be authored with or reference any tool, generator or author name. No comments explaining intent at length. Documentation only in `.md` files.
- Respect `docs/STRUCTURE.md`: components stay in `components/{ui,layout,product,category}`; this plan adds `SiteShell` to `components/layout/`.
- After implementation, verify per-route (explicitly, one check per route) that Header and Footer render exactly once — not zero times, not twice. This check must be run and its result reported for every one of the 9 top-level routes.
- Update `docs/STRUCTURE.md` to require every new route under `app/[locale]/` to have a `layout.tsx` rendering `SiteShell`, with the reason stated. Update `docs/ARCHITECTURE.md` with the underlying reason (RSC cannot pass data from child to shared parent layout).
- `npx tsc --noEmit` and `npm run build` must both pass clean at the end, exactly as required for the original Phase 8 plan.

---

## File Structure

**New files:**
- `components/layout/SiteShell.tsx` — composes `Header` + `{children}` + `Footer`, given `locale`, `dictionary`, `languages`
- `app/[locale]/(home)/layout.tsx` — **NOT used**; see Task 1 note on why the homepage requires special handling (no route group needed, `page.tsx` stays where it is; the "layout" for home is folded into a small conditional rather than a new directory — see Task 2)
- `app/[locale]/cart/layout.tsx`
- `app/[locale]/account/layout.tsx`
- `app/[locale]/categories/layout.tsx` (covers the categories list page)
- `app/[locale]/categories/[category]/layout.tsx`
- `app/[locale]/products/[product]/layout.tsx`
- `app/[locale]/pages/[slug]/layout.tsx`
- `app/[locale]/blogs/articles/layout.tsx` (covers the articles list page)
- `app/[locale]/blogs/articles/[slug]/layout.tsx`

**Modified files:**
- `app/[locale]/layout.tsx` — strip down to document shell only, remove `Header`/`Footer` rendering and the `getAlternates(locale, {type:"home"})` call used for `Header`'s `languages` prop (its `generateMetadata` call for hreflang metadata stays, since that's a separate, still-correct concern)
- `docs/STRUCTURE.md` — new rule: every route under `app/[locale]/` must have a `layout.tsx` rendering `SiteShell`
- `docs/ARCHITECTURE.md` — new section explaining the RSC child-to-parent limitation and this fix

**Deleted files:** none.

---

## Task 1: `SiteShell` component

**Files:**
- Create: `components/layout/SiteShell.tsx`

**Interfaces:**
- Consumes: `Header` and `Footer` from `components/layout/Header.tsx` / `Footer.tsx` (unchanged interfaces: `Header({locale, dictionary, languages})`, `Footer({locale, dictionary})`).
- Produces: `SiteShell({locale, dictionary, languages, children}): JSX.Element` — a server component, consumed by every layout added in Tasks 2-9.

- [ ] **Step 1: Create `components/layout/SiteShell.tsx`**

```tsx
import type { ReactNode } from "react";
import type nl from "@/dictionaries/nl.json";
import type { Locale } from "@/lib/i18n";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

export function SiteShell({
  locale,
  dictionary,
  languages,
  children,
}: {
  locale: Locale;
  dictionary: typeof nl;
  languages: Partial<Record<Locale, string>>;
  children: ReactNode;
}) {
  return (
    <>
      <Header locale={locale} dictionary={dictionary} languages={languages} />
      {children}
      <Footer locale={locale} dictionary={dictionary} />
    </>
  );
}
```

Note: `Header`/`Footer` are unconditionally rendered as siblings around `{children}`, matching exactly what `app/[locale]/layout.tsx` did before this plan — this is a pure extraction, not a redesign, so the visual output is identical.

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no new errors (this file isn't consumed by anything yet, so it should just type-check standalone).

- [ ] **Step 3: Commit**

```bash
git add components/layout/SiteShell.tsx
git commit -m "feat: extract SiteShell composing Header and Footer"
```

---

## Task 2: Strip `app/[locale]/layout.tsx` to document shell, wire home page's own alternates via a thin wrapper

**Files:**
- Modify: `app/[locale]/layout.tsx`

**Interfaces:**
- Consumes: `SiteShell` is NOT used here — this file becomes pure document shell.
- Produces: a `<main id="main-content">{children}</main>` structure that every route (including the bare homepage `page.tsx`, which has no subdirectory of its own to hold a nested layout) renders into.

**Design note on the homepage:** `app/[locale]/page.tsx` lives in the same directory as `app/[locale]/layout.tsx` — there is no separate directory to place a `app/[locale]/(home-only)/layout.tsx` in without introducing a route group, and the user's constraint set doesn't ask for one. Since the homepage's alternates are always `{type: "home"}` — a fixed kind requiring no params, identical to what the root layout already computed before this plan — the pragmatic, minimal-diff approach is: the root layout keeps a FALLBACK `SiteShell` render for routes that don't have their own nested layout overriding it. But every other route in this plan (Tasks 3-9) WILL have its own nested layout, so nesting works as follows: **Next.js composes nested layouts by wrapping** — `app/[locale]/layout.tsx` renders `{children}`, and if `app/[locale]/cart/layout.tsx` exists, it renders BETWEEN the root layout and `cart/page.tsx`. That means if the root layout renders `SiteShell` and `cart/layout.tsx` ALSO renders `SiteShell`, cart would get Header/Footer twice (nested).

Therefore the correct design is the reverse of a naive reading: **the root layout renders `SiteShell` only for routes that have no more specific layout of their own** — but Next.js has no "renders only if no override" primitive; nested layouts always wrap, they don't replace. The actual correct pattern: `app/[locale]/layout.tsx` must NOT render `SiteShell` at all (per Global Constraints — document shell only), and instead **every route without an already-more-specific layout needs its own layout too**, including a layout for the bare home segment. Since `page.tsx` and `layout.tsx` can coexist in the same directory and `layout.tsx` wraps `page.tsx` in that same directory, `app/[locale]/layout.tsx` wrapping `app/[locale]/page.tsx` directly means **the root layout IS the home page's nearest layout** — there is no way to give home page a MORE specific layout without a route group, and the constraints forbid restructuring routes. Given that, home page's `SiteShell` rendering has to happen somewhere in the `app/[locale]/layout.tsx` → `page.tsx` chain, and since the root layout must stay pure shell, the only place left is a **route-group-free trick**: keep `app/[locale]/layout.tsx` as pure shell as required, and accept that the home page's `SiteShell` is rendered by `app/[locale]/page.tsx` itself wrapping its own content — NOT as a `layout.tsx`, but the page component returning `<SiteShell>...</SiteShell>` around its own JSX. This is consistent with the constraint "every route gets a layout.tsx rendering SiteShell" for every route EXCEPT home, which structurally cannot have a separate layout without a route group; document this one exception explicitly rather than silently deviating.

- [ ] **Step 1: Replace `app/[locale]/layout.tsx` with document-shell-only content**

```tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Dosis, Montserrat } from "next/font/google";
import { locales, isLocale } from "@/lib/i18n";
import { getAlternates } from "@/lib/alternates";
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

  return (
    <html lang={locale} className={`${dosis.variable} ${montserrat.variable}`}>
      <body className="bg-background font-body text-text">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-accent focus:px-4 focus:py-2 focus:text-text"
        >
          {dictionary.nav.skipToContent}
        </a>
        <main id="main-content">{children}</main>
      </body>
    </html>
  );
}
```

Note: `generateMetadata` here keeps computing `{type: "home"}` alternates — this is CORRECT for this file, because `generateMetadata` here always describes the root layout's OWN metadata contribution, and Next.js merges `generateMetadata` across the whole layout chain, with the MOST SPECIFIC segment's `alternates` winning. Every nested route added in Tasks 3-9 will have its own `generateMetadata` (either pre-existing from earlier Phase 8 tasks, for the dynamic routes, or none needed for the static ones since their alternates never change) that overrides this at the metadata level. This file's `generateMetadata` is only the fallback that actually applies to the bare home route now, which is correct since home's alternates truly are `{type:"home"}`.

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: errors are EXPECTED at this point, since `app/[locale]/page.tsx` (Task 3) hasn't been updated yet to wrap itself in `SiteShell`, and no route has Header/Footer until the following tasks land. This is fine — do not treat mid-plan type errors as a blocker; the plan's tasks are sequenced so the build is only expected to be fully clean again after Task 9. If `tsc --noEmit` reports errors unrelated to missing Header/Footer rendering (e.g., import errors, syntax errors) in THIS file, fix those, but do not attempt to make the whole app render correctly yet.

- [ ] **Step 3: Commit**

```bash
git add "app/[locale]/layout.tsx"
git commit -m "refactor: strip root layout to document shell only"
```

---

## Task 3: Homepage renders its own `SiteShell`

**Files:**
- Modify: `app/[locale]/page.tsx`

**Interfaces:**
- Consumes: `SiteShell` (Task 1), `getAlternates` (existing, `{type: "home"}` kind).

- [ ] **Step 1: Wrap the homepage's existing content in `SiteShell`**

Read the current `app/[locale]/page.tsx` first to preserve its existing product-fetching logic exactly (added in Phase 8 Task 14 — `getFilteredProducts`, `ProductCard`, `Container` grid). Only add the `SiteShell` wrapper and the alternates/dictionary plumbing needed to feed it; do not change the product-fetching or grid-rendering logic.

```tsx
import { notFound } from "next/navigation";
import { locales, isLocale, type Locale } from "@/lib/i18n";
import { getFilteredProducts } from "@/lib/queries";
import { getAlternates } from "@/lib/alternates";
import { Container } from "@/components/ui/Container";
import { ProductCard } from "@/components/product/ProductCard";
import { SiteShell } from "@/components/layout/SiteShell";
import nl from "@/dictionaries/nl.json";
import en from "@/dictionaries/en.json";
import fr from "@/dictionaries/fr.json";

const dictionaries = { nl, en, fr };

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
  const dictionary = dictionaries[locale];
  const alternates = await getAlternates(locale, { type: "home" });
  const products = await getFilteredProducts("all", locale, []);

  return (
    <SiteShell locale={locale} dictionary={dictionary} languages={alternates?.languages ?? {}}>
      <Container className="py-10">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((item) => (
            <ProductCard key={item.id} product={item} locale={locale} />
          ))}
        </div>
      </Container>
    </SiteShell>
  );
}
```

`getAlternates(locale, {type:"home"})` here is the SAME cache key as the one `app/[locale]/layout.tsx`'s `generateMetadata` calls (Task 2), so React's `cache()` deduplicates this to a single execution per request — no extra cost, and this satisfies the plan's "share getAlternates via cache" requirement for the home route specifically.

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors related to `app/[locale]/page.tsx`. Errors from other not-yet-updated routes are still expected at this point in the plan (see Task 2's note) — ignore those.

- [ ] **Step 3: Commit**

```bash
git add "app/[locale]/page.tsx"
git commit -m "feat: render SiteShell with home alternates on homepage"
```

---

## Task 4: Cart and account routes get thin layouts

**Files:**
- Create: `app/[locale]/cart/layout.tsx`
- Create: `app/[locale]/account/layout.tsx`

**Interfaces:**
- Consumes: `SiteShell` (Task 1), `getAlternates` with `{type:"cart"}` / `{type:"account"}` (existing fixed-route kinds in `lib/alternates.ts`, unchanged).

- [ ] **Step 1: Create `app/[locale]/cart/layout.tsx`**

```tsx
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { getAlternates } from "@/lib/alternates";
import { SiteShell } from "@/components/layout/SiteShell";
import nl from "@/dictionaries/nl.json";
import en from "@/dictionaries/en.json";
import fr from "@/dictionaries/fr.json";

const dictionaries = { nl, en, fr };

export default async function CartLayout({
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
  const alternates = await getAlternates(locale, { type: "cart" });

  return (
    <SiteShell locale={locale} dictionary={dictionary} languages={alternates?.languages ?? {}}>
      {children}
    </SiteShell>
  );
}
```

- [ ] **Step 2: Create `app/[locale]/account/layout.tsx`**

Identical structure, `{type: "account"}`:

```tsx
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { getAlternates } from "@/lib/alternates";
import { SiteShell } from "@/components/layout/SiteShell";
import nl from "@/dictionaries/nl.json";
import en from "@/dictionaries/en.json";
import fr from "@/dictionaries/fr.json";

const dictionaries = { nl, en, fr };

export default async function AccountLayout({
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
  const alternates = await getAlternates(locale, { type: "account" });

  return (
    <SiteShell locale={locale} dictionary={dictionary} languages={alternates?.languages ?? {}}>
      {children}
    </SiteShell>
  );
}
```

- [ ] **Step 3: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors related to these two new files or `cart`/`account` page files.

- [ ] **Step 4: Commit**

```bash
git add "app/[locale]/cart/layout.tsx" "app/[locale]/account/layout.tsx"
git commit -m "feat: add cart and account layouts rendering SiteShell"
```

---

## Task 5: Categories list and category detail routes get thin layouts

**Files:**
- Create: `app/[locale]/categories/layout.tsx`
- Create: `app/[locale]/categories/[category]/layout.tsx`

**Interfaces:**
- Consumes: `SiteShell` (Task 1), `getAlternates` with `{type:"categories"}` (fixed) and `{type:"category", slug}` (dynamic, existing).

- [ ] **Step 1: Create `app/[locale]/categories/layout.tsx`** (covers the categories LIST page, fixed kind)

```tsx
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { getAlternates } from "@/lib/alternates";
import { SiteShell } from "@/components/layout/SiteShell";
import nl from "@/dictionaries/nl.json";
import en from "@/dictionaries/en.json";
import fr from "@/dictionaries/fr.json";

const dictionaries = { nl, en, fr };

export default async function CategoriesLayout({
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
  const alternates = await getAlternates(locale, { type: "categories" });

  return (
    <SiteShell locale={locale} dictionary={dictionary} languages={alternates?.languages ?? {}}>
      {children}
    </SiteShell>
  );
}
```

**Important Next.js nesting note:** `app/[locale]/categories/layout.tsx` wraps BOTH `app/[locale]/categories/page.tsx` (the list) AND everything under `app/[locale]/categories/[category]/` (the detail route), because nested layouts wrap all deeper segments. This means if `app/[locale]/categories/[category]/layout.tsx` (Step 2 below) ALSO renders `SiteShell`, category detail pages would get Header/Footer twice (nested `SiteShell` inside `SiteShell`). Step 2 must NOT render `SiteShell` again — see Step 2's note.

- [ ] **Step 2: Create `app/[locale]/categories/[category]/layout.tsx`** (covers category DETAIL — must NOT re-wrap in SiteShell, since the parent `categories/layout.tsx` from Step 1 already does)

This is the resolution to the nesting problem: since `categories/layout.tsx` already wraps everything under `categories/`, including `[category]/`, the detail route's OWN layout must instead REPLACE what the parent's `SiteShell` receives — but Next.js doesn't support a child layout overriding a parent's already-rendered props. The correct fix: **`categories/layout.tsx` must NOT hardcode `{type:"categories"}`** — it needs to know whether it's wrapping the list or a detail page, which it can't. Therefore, the real solution is: **do not create `categories/layout.tsx` for the shared `{type:"categories"}` case at all** — instead, move the `SiteShell` render for the LIST page down into `app/[locale]/categories/page.tsx` itself (same pattern as Task 3's homepage), and let `app/[locale]/categories/[category]/layout.tsx` be the ONLY layout under `categories/`, computing `{type:"category", slug: category}` from its own params.

Redo Step 1: **do not create `app/[locale]/categories/layout.tsx`.** Instead:

- [ ] **Step 1 (revised): Modify `app/[locale]/categories/page.tsx` to render its own `SiteShell`** (same pattern as Task 3), using `getAlternates(locale, {type: "categories"})`. Read the file's current content first (from Phase 8 Task 14 — `getFilteredProducts`, `ProductCard`, `Container` grid) and only add the `SiteShell` wrapper, preserving existing logic exactly.

- [ ] **Step 2: Create `app/[locale]/categories/[category]/layout.tsx`**, the only layout under `categories/`, computing the DYNAMIC kind from its own params:

```tsx
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { getAlternates } from "@/lib/alternates";
import { SiteShell } from "@/components/layout/SiteShell";
import nl from "@/dictionaries/nl.json";
import en from "@/dictionaries/en.json";
import fr from "@/dictionaries/fr.json";

const dictionaries = { nl, en, fr };

export default async function CategoryDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string; category: string }>;
}) {
  const { locale: rawLocale, category } = await params;

  if (!isLocale(rawLocale)) {
    notFound();
  }

  const locale = rawLocale;
  const dictionary = dictionaries[locale];
  const alternates = await getAlternates(locale, { type: "category", slug: category });

  return (
    <SiteShell locale={locale} dictionary={dictionary} languages={alternates?.languages ?? {}}>
      {children}
    </SiteShell>
  );
}
```

Since `app/[locale]/categories/[category]/layout.tsx` only wraps routes under `[category]/` (not the sibling `categories/page.tsx` list, which is a different segment level entirely — `categories/page.tsx` sits ABOVE `[category]/`, not inside it), this does not conflict with Step 1's `SiteShell` render in `categories/page.tsx`. Each gets exactly one `SiteShell`.

- [ ] **Step 3: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors related to `categories/page.tsx` or `categories/[category]/layout.tsx`.

- [ ] **Step 4: Commit**

```bash
git add "app/[locale]/categories/page.tsx" "app/[locale]/categories/[category]/layout.tsx"
git commit -m "feat: render SiteShell with route-specific alternates on categories routes"
```

---

## Task 6: Product detail route gets a thin layout

**Files:**
- Create: `app/[locale]/products/[product]/layout.tsx`

**Interfaces:**
- Consumes: `SiteShell` (Task 1), `getAlternates` with `{type:"product", slug}` (existing dynamic kind).

Note: there is no `products/page.tsx` list route in this codebase (only `products/[product]/`), so there's no sibling-list-vs-detail nesting conflict like Task 5's — this is a single thin layout.

- [ ] **Step 1: Create `app/[locale]/products/[product]/layout.tsx`**

```tsx
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { getAlternates } from "@/lib/alternates";
import { SiteShell } from "@/components/layout/SiteShell";
import nl from "@/dictionaries/nl.json";
import en from "@/dictionaries/en.json";
import fr from "@/dictionaries/fr.json";

const dictionaries = { nl, en, fr };

export default async function ProductDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string; product: string }>;
}) {
  const { locale: rawLocale, product } = await params;

  if (!isLocale(rawLocale)) {
    notFound();
  }

  const locale = rawLocale;
  const dictionary = dictionaries[locale];
  const alternates = await getAlternates(locale, { type: "product", slug: product });

  return (
    <SiteShell locale={locale} dictionary={dictionary} languages={alternates?.languages ?? {}}>
      {children}
    </SiteShell>
  );
}
```

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors related to this file.

- [ ] **Step 3: Commit**

```bash
git add "app/[locale]/products/[product]/layout.tsx"
git commit -m "feat: render SiteShell with product alternates on product detail route"
```

---

## Task 7: Content pages route gets a thin layout

**Files:**
- Create: `app/[locale]/pages/[slug]/layout.tsx`

**Interfaces:**
- Consumes: `SiteShell` (Task 1), `getAlternates` with `{type:"page", key}` (existing dynamic kind) and `resolvePageKey` from `lib/pages.ts` (existing, already used in the sibling `page.tsx`).

- [ ] **Step 1: Create `app/[locale]/pages/[slug]/layout.tsx`**

This route's alternates depend on resolving the raw `slug` param to a `PageKey` first (same as the existing `page.tsx`'s `generateMetadata` already does) — if it doesn't resolve, `languages` falls back to `{}` and `notFound()` still fires from the page component itself (unchanged), not from this layout, since a layout rendering around a page that will itself call `notFound()` is fine — Next.js handles `notFound()` from either level correctly.

```tsx
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { resolvePageKey } from "@/lib/pages";
import { getAlternates } from "@/lib/alternates";
import { SiteShell } from "@/components/layout/SiteShell";
import nl from "@/dictionaries/nl.json";
import en from "@/dictionaries/en.json";
import fr from "@/dictionaries/fr.json";

const dictionaries = { nl, en, fr };

export default async function ContentPageLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug } = await params;

  if (!isLocale(rawLocale)) {
    notFound();
  }

  const locale = rawLocale;
  const dictionary = dictionaries[locale];
  const key = resolvePageKey(locale, slug);
  const alternates = key ? await getAlternates(locale, { type: "page", key }) : undefined;

  return (
    <SiteShell locale={locale} dictionary={dictionary} languages={alternates?.languages ?? {}}>
      {children}
    </SiteShell>
  );
}
```

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors related to this file.

- [ ] **Step 3: Commit**

```bash
git add "app/[locale]/pages/[slug]/layout.tsx"
git commit -m "feat: render SiteShell with page alternates on content page route"
```

---

## Task 8: Articles list and article detail routes get thin layouts

**Files:**
- Modify: `app/[locale]/blogs/articles/page.tsx`
- Create: `app/[locale]/blogs/articles/[slug]/layout.tsx`

**Interfaces:**
- Consumes: `SiteShell` (Task 1), `getAlternates` with `{type:"articles"}` (fixed) and `{type:"article", slug}` (dynamic, existing).

Same nesting consideration as Task 5 (categories): `blogs/articles/[slug]/` is nested under `blogs/articles/`, so if BOTH levels rendered `SiteShell`, article detail pages would double-wrap. Follow the same resolution as Task 5: the LIST page (`blogs/articles/page.tsx`) renders its own `SiteShell` directly (not via a `blogs/articles/layout.tsx`), and only `blogs/articles/[slug]/layout.tsx` exists as an actual layout file, scoped to the detail route only.

- [ ] **Step 1: Modify `app/[locale]/blogs/articles/page.tsx` to render its own `SiteShell`**

Read the file's current content first (from Phase 8 Task 17 — currently a `Container`-wrapped empty placeholder `<ul></ul>`, no listing logic) and only add the `SiteShell` wrapper, preserving the existing placeholder content exactly — do not add real article-fetching logic, that remains out of scope.

```tsx
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { getAlternates } from "@/lib/alternates";
import { Container } from "@/components/ui/Container";
import { SiteShell } from "@/components/layout/SiteShell";
import nl from "@/dictionaries/nl.json";
import en from "@/dictionaries/en.json";
import fr from "@/dictionaries/fr.json";

const dictionaries = { nl, en, fr };

export default async function ArticlesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;

  if (!isLocale(rawLocale)) {
    notFound();
  }

  const locale = rawLocale;
  const dictionary = dictionaries[locale];
  const alternates = await getAlternates(locale, { type: "articles" });

  return (
    <SiteShell locale={locale} dictionary={dictionary} languages={alternates?.languages ?? {}}>
      <Container className="py-10">
        <ul></ul>
      </Container>
    </SiteShell>
  );
}
```

- [ ] **Step 2: Create `app/[locale]/blogs/articles/[slug]/layout.tsx`**

```tsx
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { getAlternates } from "@/lib/alternates";
import { SiteShell } from "@/components/layout/SiteShell";
import nl from "@/dictionaries/nl.json";
import en from "@/dictionaries/en.json";
import fr from "@/dictionaries/fr.json";

const dictionaries = { nl, en, fr };

export default async function ArticleDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug } = await params;

  if (!isLocale(rawLocale)) {
    notFound();
  }

  const locale = rawLocale;
  const dictionary = dictionaries[locale];
  const alternates = await getAlternates(locale, { type: "article", slug });

  return (
    <SiteShell locale={locale} dictionary={dictionary} languages={alternates?.languages ?? {}}>
      {children}
    </SiteShell>
  );
}
```

- [ ] **Step 3: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors related to these two files.

- [ ] **Step 4: Commit**

```bash
git add "app/[locale]/blogs/articles/page.tsx" "app/[locale]/blogs/articles/[slug]/layout.tsx"
git commit -m "feat: render SiteShell with route-specific alternates on article routes"
```

---

## Task 9: Per-route Header/Footer occurrence audit, then full verification

**Files:** none created/modified — verification only, EXCEPT fixing whatever the audit finds broken.

**Interfaces:** none.

This task exists because the plan's Global Constraints explicitly require an explicit, per-route, reported check that Header and Footer render exactly once (not zero, not two) on every one of the 9 top-level routes. Do this by starting the dev server and fetching each route's HTML, then grepping for the number of times a unique Header marker and a unique Footer marker appear.

- [ ] **Step 1: Identify unique markers**

`Header` renders a `<header className="border-b border-border bg-background">` — this exact class combination is unique to `Header` in the whole codebase. `Footer` renders a `<footer className="bg-contrast text-background">` — also unique. Confirm this by grepping the component files if needed.

- [ ] **Step 2: Start the production build and server**

```bash
npm run build
npm run start
```

(Run `start` with a background/non-blocking approach appropriate to your environment, or use `next dev` if that's more practical for local route-by-route curl checks — either is acceptable for this audit, since the goal is checking rendered HTML structure, not performance.)

- [ ] **Step 3: Fetch and count Header/Footer occurrences for each of these 9 routes** (using `nl` as the sample locale; the same layout structure applies to `en`/`fr` since routing is locale-parallel)

For each route below, run `curl -s http://localhost:3000/nl/<path> | grep -o '<header class="border-b border-border bg-background"' | wc -l` (expect exactly `1`) and the equivalent for `<footer class="bg-contrast text-background"` (expect exactly `1`):

1. `/nl` (home)
2. `/nl/cart`
3. `/nl/account`
4. `/nl/categorie` (categories list — note the Dutch segment from `lib/segments.ts`)
5. `/nl/categorie/noten` (or any real seeded category slug — check `prisma/seed.ts` for a valid one)
6. `/nl/producten/amandelen-spanje` (or any real seeded product slug from `prisma/seed.ts`)
7. `/nl/paginas/over-ons` (or any real seeded content page slug from `lib/pages.ts`'s `pageSlugs`)
8. `/nl/blogs/articles` (articles list)
9. `/nl/blogs/articles/<any-slug>` — if no article exists in the seed data, this route will 404 before rendering `SiteShell`; note in the report whether this route could be tested with real data, and if not, explain why (no seeded articles) rather than skip it silently.

Report the count for both Header and Footer on all 9 routes as a table in your task output. Any route showing 0 or 2+ for either marker is a bug — trace which layout is missing `SiteShell` (0 case) or which layout nesting is double-wrapping (2+ case, most likely the `categories`/`articles` nesting pattern from Tasks 5/8 if the "move list page's SiteShell out of a shared layout" resolution wasn't applied correctly) and fix it before proceeding. Do not mark this task complete with any route showing an incorrect count.

- [ ] **Step 4: Full verification**

Run: `npx tsc --noEmit`
Expected: zero errors.

Run: `npm run build`
Expected: build succeeds, same 103-page-style static generation as the original Phase 8 Task 19 verification, now with additional `layout.tsx` files in the route tree (these don't add new routes/pages, only new wrapping layers, so the page count should be unchanged).

- [ ] **Step 5: Commit any audit-driven fixes**

If Step 3 found and required fixing a double-wrap or missing-wrap bug, commit that fix separately from documentation (Task 10):

```bash
git add -A
git commit -m "fix: correct SiteShell wrapping found during route audit"
```

(Only run this if a fix was actually needed — if the audit passed cleanly on the first pass, skip this step, no empty commit.)

---

## Task 10: Documentation

**Files:**
- Modify: `docs/STRUCTURE.md`
- Modify: `docs/ARCHITECTURE.md`

**Interfaces:** none.

- [ ] **Step 1: Update `docs/STRUCTURE.md`**

Add a new placement rule (near the existing `components/` domain-grouping rule):

```markdown
- Every route under `app/[locale]/` that is not the bare home segment has
  its own `layout.tsx` rendering `SiteShell` from `components/layout/`,
  computed from that route's own params. The home route (`app/[locale]/page.tsx`)
  renders `SiteShell` directly in the page component instead, since it
  shares its directory with the root layout and has no route segment of
  its own to hold a separate layout. `SiteShell` is the only place
  `Header` and `Footer` are composed together; no other file renders them.
```

- [ ] **Step 2: Update `docs/ARCHITECTURE.md`**

Add a new section (after the existing "Single source of truth for cross-locale URLs" section from Phase 8):

```markdown
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
Every top-level route under `app/[locale]/` — cart, account, categories,
the category detail route, the product detail route, content pages, and
both article routes — has its own thin `layout.tsx` that reads its own
route params, computes the correct `AlternateKind` for `getAlternates`,
and renders `SiteShell` (the single place `Header` and `Footer` are
composed) with the resulting `languages` map. The home route is the one
exception: since `app/[locale]/page.tsx` shares a directory with the root
layout, it cannot have a more specific layout of its own without
introducing a route group, so it renders `SiteShell` directly in the page
component instead of via a separate `layout.tsx`.

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
```

- [ ] **Step 3: Commit**

```bash
git add docs/STRUCTURE.md docs/ARCHITECTURE.md
git commit -m "docs: document per-route layout pattern for locale switcher alternates"
```

---

## Self-Review Notes

- **Spec coverage:** All 8 numbered requirements from the user's decision are covered: SiteShell as sole Header/Footer composition point (Task 1), root layout stripped to document shell (Task 2), every top-level route gets a layout rendering SiteShell with the home-page exception explicitly carved out and documented (Tasks 3-8), getAlternates shared via cache with no signature change (verified in every task's alternates call, same function/kind pairs `generateMetadata` already used), Header/LocaleSwitcher interfaces unchanged (verified — no task modifies `components/layout/Header.tsx` or `LocaleSwitcher.tsx`), STRUCTURE.md rule added (Task 10), per-route Header/Footer occurrence audit with reported results (Task 9), ARCHITECTURE.md reasoning documented (Task 10).
- **Placeholder scan:** No TBD/TODO. The plan's own reasoning through the categories/articles nesting conflict is left IN the plan text deliberately (Task 5 and Task 8's "revised" framing) because it documents a real design correction made during planning, not a placeholder — the final code shown is complete and correct, the surrounding prose explains why the naive approach (a shared `layout.tsx` for both list and detail) doesn't work.
- **Type consistency:** `SiteShell`'s props (`locale`, `dictionary: typeof nl`, `languages: Partial<Record<Locale,string>>`, `children`) are used identically across every one of Tasks 3-8's call sites. Every dynamic route's `AlternateKind` argument matches `lib/alternates.ts`'s existing discriminated union exactly (`{type:"category",slug}`, `{type:"product",slug}`, `{type:"page",key}`, `{type:"article",slug}`), with no new kinds introduced.
