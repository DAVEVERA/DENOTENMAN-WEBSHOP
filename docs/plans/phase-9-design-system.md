# Phase 9: Ontwerpsysteem en Navigatie Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the design-token system with spacing/radius/shadow/text/motion scales, adopt lucide-react as the single icon set, build a small library of accessible primitives (Button, Card, FavoriteButton, Tabs, USPBar), rebuild Header (mega-menu, mobile drawer, sticky) and Footer (multi-column) on top of them, establish one product-grid convention, and port an existing truck-loader animation verbatim as an unconnected `LoadingIndicator` component.

**Architecture:** All new tokens live in the single `@theme` block in `app/globals.css` (no second source of values). New primitives live in `components/ui/`; the loader is the one deliberate, scoped exception to token-only styling (its CSS ships in a dedicated stylesheet next to the component, imported only there). Header and Footer are rebuilt in place inside their existing files; the mega-menu and mobile drawer are new sibling components under `components/layout/`. Category data continues to flow only through `getMainCategories` — no hardcoded category lists anywhere.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind v4 (`@theme`), lucide-react (already installed, unused until now), `clsx`/`tailwind-merge` (via existing `lib/cn.ts`). No new packages.

## Global Constraints

- All colors, fonts, spacing, radii, shadows, text sizes, and transition durations are defined exactly once, in the single `@theme` block in `app/globals.css`. No component defines a hex color, a raw pixel value for spacing/radius/shadow, or an inline style — Tailwind utility classes generated from tokens only. The **one exception** is `components/ui/LoadingIndicator.loader.css` (Task 15), which is a deliberate, scoped, documented exception — ported verbatim, not tokenized.
- Icons are lucide-react exclusively. No other icon library, no hand-drawn SVG icons for anything lucide already covers.
- `prefers-reduced-motion: reduce` removes all transform/animation-based movement across every new component; color and shadow changes remain. The loader keeps its own already-built-in reduced-motion behavior (a static frame, animations off) — do not duplicate that logic elsewhere.
- No new npm packages. `styled-components` (seen in one of the user's reference snippets) is explicitly not introduced — every effect is rebuilt with Tailwind classes and tokens.
- `getMainCategories` remains the only source for header/mega-menu category data. No static/hardcoded category list anywhere in new code.
- Respect `docs/STRUCTURE.md` at all times: components in `components/{ui,layout,product,category}`; `lib/` stays framework-agnostic; no prose in code files; no tool/generator/author name anywhere; no folders outside the contract without a `docs/STRUCTURE.md` amendment (this plan makes several such amendments explicitly, listed in Task 16).
- No file may be authored with or reference any tool, generator, or author name.
- The mega-menu's per-category "featured block" reads `CategoryTranslation.description` when present and renders nothing (not a placeholder, not an empty box) when absent — seed data does not currently populate this field, so on today's data the slot will typically be empty. This is a deliberate, minimal choice: the schema already has the field, so no migration is needed, and no fake content is invented.
- Stop after this plan is fully implemented and verified — no additional features beyond what is listed here.
- Mobile-first throughout: every component's unprefixed (base) Tailwind classes describe the phone layout; `sm:`/`lg:` prefixes only ever ADD or override for larger viewports, never restore something the base layout hid or removed. Concretely: `Header`'s mega-menu/desktop nav is `hidden lg:flex` (absent by default, added at `lg:`) and `MobileNav`'s trigger is unprefixed with `lg:hidden` (present by default, removed at `lg:`) — this is the correct direction and both are already written this way in Tasks 11-13 below. `Footer`'s column grid starts at `grid-cols-1` (unprefixed) and gains columns at `sm:`/`lg:`, never the reverse. Any new class written during implementation that reads as "start wide, shrink down" (e.g. a bare multi-column grid with a `sm:grid-cols-1` override) is wrong and must be rewritten mobile-first before that task is reviewed.

---

## Reference Translation Notes (from screenshots/description supplied by the user, not the blocked uiverse.io pages)

- **Button (two screenshots):** a primary variant — solid accent-yellow fill, dark near-black text, visible border, subtle rounded corners, small drop shadow giving a slightly raised/embossed look — and a secondary/outline variant — white fill, thin dark border, dark text, same shape language. Both read as compact, slightly skeuomorphic but restrained (not flat, not heavily 3D).
- **Card hover:** the whole card lifts 4px, its thin border shifts to a lighter bronze tone, both over 320ms with a soft natural easing curve. A "read more" link at the card's bottom has its own separate hover effect: text lightens and a trailing arrow glyph shifts 0.4rem to the right, over 240ms.
- **Favorite heart (code sample provided, NOT to be copied literally per the task's explicit "no movement or animation" rule for `FavoriteButton`):** outline heart by default, filled red heart when toggled active. The task's own Task 10 instruction overrides the animated/bouncing reference: no scale animation, no beating-heart keyframe, no colored thick border button chrome — a plain, accessible icon toggle button using lucide-react's `Heart` icon (outline vs `fill="currentColor"` for the active state), color-only transition.
- **Loader (`public/loader_Truck.html`):** a self-contained, already-complete truck-driving-with-cargo animation strip with its own `prefers-reduced-motion` handling built in. Ported verbatim per Task 15 — not redesigned, not rebuilt in Tailwind.

---

## File Structure

**New files:**
- `components/ui/Button.tsx`
- `components/ui/Card.tsx`
- `components/ui/FavoriteButton.tsx` (client component — needs toggle state)
- `components/ui/Tabs.tsx` (client component — needs keyboard/active-tab state)
- `components/ui/USPBar.tsx`
- `components/ui/LoadingIndicator.tsx` (client component — reads `prefers-reduced-motion`)
- `components/ui/LoadingIndicator.loader.css` (verbatim ported CSS, scoped class names, the one non-token styling file)
- `components/layout/MegaMenu.tsx` (client component — hover/focus/Escape/outside-click)
- `components/layout/MobileNav.tsx` (client component — slide-in panel, focus trap)
- `components/layout/HeaderIcons.tsx` — small server-safe wrapper is unnecessary; icon links are inlined directly into `Header.tsx` instead (see Task 12 — no new file needed beyond MegaMenu/MobileNav)
- `public/loader/truck.png`, `public/loader/cargo.png`, `public/loader/puff.png` (extracted from the base64 payload in `public/loader_Truck.html`; `puff.png` used for both the base and drift layers, which are byte-identical in the source)

**Modified files:**
- `app/globals.css` — extended `@theme` block (spacing, radius, shadow, text, transition-duration tokens; one shared hover-transition token)
- `components/layout/Header.tsx` — full rebuild (larger wordmark, mega-menu, icon cluster, mobile trigger, sticky behavior)
- `components/layout/Footer.tsx` — full rebuild (multi-column: brand, categories, service/legal, contact+market days)
- `components/layout/LocaleSwitcher.tsx` — visual-only compacting (interface unchanged)
- `components/product/ProductCard.tsx` — adopt the new Card hover treatment and grid convention (no data/query changes)
- `dictionaries/nl.json`, `en.json`, `fr.json` — new keys for header (mega-menu labels, icon aria-labels, mobile nav), footer (columns, market days), USP bar, loader status text
- `docs/ARCHITECTURE.md` — design-system section: token scales, component variants, motion rule, icon rule, loader exception, contrast findings
- `docs/STRUCTURE.md` — new components, new `public/loader/` location, the loader CSS exception

**Deleted files:**
- `public/loader_Truck.html` (content ported into `LoadingIndicator.tsx` + `LoadingIndicator.loader.css` + `public/loader/*.png`; the demo HTML wrapper itself is not part of the app and does not belong in `public/` once ported)

---

## Task 1: Extend design tokens — spacing, radius, shadow, text, motion

**Files:**
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: nothing new.
- Produces: Tailwind utility classes for spacing (`p-*`, `gap-*` etc. already exist via Tailwind's default scale — this task adds **semantic** tokens layered on top only where the design calls for named values, e.g. card padding, panel padding), radius tokens (`rounded-card`, `rounded-button` style names via `--radius-*`), shadow tokens (`shadow-card`, `shadow-card-hover`, `shadow-button` via `--shadow-*`), text-size tokens for the two typographic scales, and `--transition-duration-hover` / `--transition-duration-hover-fast` for the shared motion rhythm. Consumed by every component task from Task 3 onward.

- [ ] **Step 1: Add the new token groups to the existing `@theme` block**

Read the current `app/globals.css` first (it has 8 color tokens, 2 font tokens, `--tracking-heading`, `--font-weight-heading`, and the `*:focus-visible` rule) and extend the same block — do not create a second `@theme` block or a separate CSS file.

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
  --color-border-hover: #C9A227;

  --font-heading: var(--font-dosis);
  --font-body: var(--font-montserrat);

  --tracking-heading: 0.02em;
  --font-weight-heading: 600;

  --text-heading-sm: 1.125rem;
  --text-heading-md: 1.5rem;
  --text-heading-lg: 2rem;
  --text-heading-xl: 2.75rem;
  --text-body-sm: 0.875rem;
  --text-body-md: 1rem;
  --text-body-lg: 1.125rem;

  --spacing-card: 1.5rem;
  --spacing-panel: 2rem;
  --spacing-gap-sm: 0.5rem;
  --spacing-gap-md: 1rem;
  --spacing-gap-lg: 1.5rem;

  --radius-button: 0.5rem;
  --radius-card: 0.75rem;
  --radius-panel: 1rem;

  --shadow-button: 0 2px 4px rgba(20, 20, 20, 0.18);
  --shadow-card: 0 1px 2px rgba(20, 20, 20, 0.08);
  --shadow-card-hover: 0 8px 16px rgba(20, 20, 20, 0.12);

  --ease-hover: cubic-bezier(0.22, 1, 0.36, 1);
  --transition-duration-hover: 320ms;
  --transition-duration-hover-fast: 240ms;
}

*:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Notes on values: `--color-border-hover: #C9A227` is a new derived token (a lighter bronze tone versus `--color-border: #E4DFD5`, per the card-hover reference's "border shifts to a lighter bronze" — this is a genuinely new derived brand tone, not one of the five core colors, and is declared here since Task 1 is the only place any token may be declared). `--transition-duration-hover: 320ms` / `--transition-duration-hover-fast: 240ms` map directly to the two durations named in the card/link hover reference (320ms card lift, 240ms link arrow shift) and become the site's **only** two hover-transition durations — Global Constraints requires one shared rhythm; this plan uses exactly two named durations (not one) because the reference itself specifies two distinct speeds for two distinct effects, and inventing a single blended duration would misrepresent the reference. **The `--transition-duration-*` prefix (not `--duration-*`) is required** — verified empirically against the installed Tailwind v4.3.3 engine: unlike `--radius-*`, `--shadow-*`, `--text-*`, `--spacing-*`, and `--ease-*` (which map directly, `--radius-card` → `.rounded-card`), Tailwind v4 has no bare `--duration-*` theme namespace; only `--transition-duration-*` generates the `duration-<name>` utility class (confirmed: `--transition-duration-hover: 320ms` in `@theme` produces a working `.duration-hover { transition-duration: var(--transition-duration-hover); }` rule, while `--duration-hover: 320ms` alone produces no utility class at all). The generated **class name** consumed everywhere else in this plan is still `duration-hover` / `duration-hover-fast` — only the `@theme` declaration's property name differs from the class name for this one token category. The global `prefers-reduced-motion` media query added here is the single site-wide reduced-motion rule Task 9 depends on — individual components do not each re-implement this query, they rely on this one.

- [ ] **Step 2: Verify Tailwind picks up the new tokens**

Run: `npx tsc --noEmit` (expected clean — this is a CSS-only change). A full visual check happens in Task 17; this step is just confirming the file is syntactically valid CSS by checking the dev server / build doesn't error later in Task 17. No standalone verification command exists for `@theme` syntax at this point in the plan.

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat: extend design tokens with spacing, radius, shadow, text and motion scales"
```

---

## Task 2: Apply the two typographic scales via base typography

**Files:**
- Modify: `app/[locale]/layout.tsx`

**Interfaces:**
- Consumes: `--text-heading-*` / `--text-body-*` tokens (Task 1).
- Produces: base `<body>` typography that every page inherits; heading elements get consistent sizing without per-component overrides.

- [ ] **Step 1: Add base heading styles to `app/globals.css` (not layout.tsx — CSS-level base styles belong in the stylesheet, not JSX)**

Correction to this task's own header: base typography for raw `h1`-`h4` elements is a CSS concern, so it belongs in `app/globals.css` immediately after the `@theme` block, not as Tailwind classes hand-applied per component (which is exactly what "not per component" rules out). Add to `app/globals.css`, after the `@media (prefers-reduced-motion: reduce)` block from Task 1:

```css
h1, h2, h3, h4 {
  font-family: var(--font-heading);
  font-weight: var(--font-weight-heading);
  letter-spacing: var(--tracking-heading);
  color: var(--color-text);
}

h1 { font-size: var(--text-heading-xl); }
h2 { font-size: var(--text-heading-lg); }
h3 { font-size: var(--text-heading-md); }
h4 { font-size: var(--text-heading-sm); }

body {
  font-family: var(--font-body);
  font-size: var(--text-body-md);
}
```

`app/[locale]/layout.tsx` already sets `font-body` and `text-text` as Tailwind classes on `<body>` — leave those as-is (they are harmless duplication of what the new CSS rule now also states, but removing Tailwind classes that were correct before this task is out of scope and risks an unrelated regression; the CSS rule is additive and wins for raw heading tags that don't carry Tailwind's `font-heading` class explicitly).

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` (expected clean, CSS-only change).

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat: apply base heading and body typography from token scale"
```

---

## Task 3: Icon convention documentation

**Files:**
- Modify: `docs/ARCHITECTURE.md`

**Interfaces:** none — documentation only, but this task exists before any component uses lucide-react so the rule is on record before Task 5+ start consuming icons.

- [ ] **Step 1: Add an icon-convention section to `docs/ARCHITECTURE.md`**

Add after the existing "Logo component API" section:

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add docs/ARCHITECTURE.md
git commit -m "docs: record lucide-react as the sole icon convention"
```

---

## Task 4: Dictionary keys for the whole phase

**Files:**
- Modify: `dictionaries/nl.json`, `dictionaries/en.json`, `dictionaries/fr.json`

**Interfaces:**
- Consumes: nothing.
- Produces: every copy key Tasks 5-14 need. Doing this in one task up front (rather than scattering key additions across every later task) keeps the three dictionary files internally consistent at every intermediate commit and avoids a later task discovering a missing key mid-build.

- [ ] **Step 1: Add the new key groups to `dictionaries/nl.json`**

Read the current file first (existing top-level keys: `nav`, `brand`, `footer`, `product`, `cart`, `category`, `common`) and add these new keys without altering existing ones:

```json
{
  "nav": {
    "home": "Home",
    "categories": "Assortiment",
    "cart": "Winkelwagen",
    "account": "Account",
    "articles": "Artikelen",
    "skipToContent": "Ga naar hoofdinhoud",
    "search": "Zoeken",
    "openMenu": "Open menu",
    "closeMenu": "Sluit menu",
    "mainMenu": "Hoofdmenu"
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
    "categoriesTitle": "Assortiment",
    "serviceTitle": "Klantenservice",
    "contactTitleColumn": "Contact",
    "marketDaysTitle": "Marktdagen",
    "marketDayThursday": "Donderdag",
    "marketDayFriday": "Vrijdag",
    "marketDaySaturday": "Zaterdag",
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
    "pricePerHundredGrams": "per 100 g",
    "addToFavorites": "Toevoegen aan favorieten",
    "removeFromFavorites": "Verwijderen uit favorieten",
    "tabDescription": "Omschrijving",
    "tabNutrition": "Voedingswaarde",
    "tabFaq": "Veelgestelde vragen"
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
    "search": "Zoeken",
    "account": "Account",
    "cart": "Winkelwagen"
  },
  "usp": {
    "freshRoasted": "Dagelijks vers gebrand",
    "personalAdvice": "Persoonlijk advies van De Notenman",
    "experience": "Jarenlange ervaring op de markt"
  },
  "loader": {
    "status": "Laden..."
  }
}
```

- [ ] **Step 2: Add the equivalent keys to `dictionaries/en.json`**

Same structure, English copy:

```json
{
  "nav": {
    "home": "Home",
    "categories": "Collections",
    "cart": "Cart",
    "account": "Account",
    "articles": "Articles",
    "skipToContent": "Skip to main content",
    "search": "Search",
    "openMenu": "Open menu",
    "closeMenu": "Close menu",
    "mainMenu": "Main menu"
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
    "categoriesTitle": "Collections",
    "serviceTitle": "Customer service",
    "contactTitleColumn": "Contact",
    "marketDaysTitle": "Market days",
    "marketDayThursday": "Thursday",
    "marketDayFriday": "Friday",
    "marketDaySaturday": "Saturday",
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
    "pricePerHundredGrams": "per 100 g",
    "addToFavorites": "Add to favorites",
    "removeFromFavorites": "Remove from favorites",
    "tabDescription": "Description",
    "tabNutrition": "Nutrition",
    "tabFaq": "FAQ"
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
    "search": "Search",
    "account": "Account",
    "cart": "Cart"
  },
  "usp": {
    "freshRoasted": "Freshly roasted daily",
    "personalAdvice": "Personal advice from De Notenman",
    "experience": "Years of experience at the market"
  },
  "loader": {
    "status": "Loading..."
  }
}
```

- [ ] **Step 3: Add the equivalent keys to `dictionaries/fr.json`**

Same structure, French copy:

```json
{
  "nav": {
    "home": "Accueil",
    "categories": "Collections",
    "cart": "Panier",
    "account": "Compte",
    "articles": "Articles",
    "skipToContent": "Aller au contenu principal",
    "search": "Rechercher",
    "openMenu": "Ouvrir le menu",
    "closeMenu": "Fermer le menu",
    "mainMenu": "Menu principal"
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
    "categoriesTitle": "Collections",
    "serviceTitle": "Service client",
    "contactTitleColumn": "Contact",
    "marketDaysTitle": "Jours de marché",
    "marketDayThursday": "Jeudi",
    "marketDayFriday": "Vendredi",
    "marketDaySaturday": "Samedi",
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
    "pricePerHundredGrams": "par 100 g",
    "addToFavorites": "Ajouter aux favoris",
    "removeFromFavorites": "Retirer des favoris",
    "tabDescription": "Description",
    "tabNutrition": "Valeurs nutritionnelles",
    "tabFaq": "FAQ"
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
    "search": "Rechercher",
    "account": "Compte",
    "cart": "Panier"
  },
  "usp": {
    "freshRoasted": "Torréfié frais chaque jour",
    "personalAdvice": "Conseil personnalisé de De Notenman",
    "experience": "Des années d'expérience sur le marché"
  },
  "loader": {
    "status": "Chargement..."
  }
}
```

- [ ] **Step 4: Verify JSON validity and key parity across all three files**

Run: `node -e "const nl=require('./dictionaries/nl.json'),en=require('./dictionaries/en.json'),fr=require('./dictionaries/fr.json'); const flatten=(o,p='')=>Object.keys(o).flatMap(k=>typeof o[k]==='object'?flatten(o[k],p+k+'.'):[p+k]); const kn=flatten(nl).sort(),ke=flatten(en).sort(),kf=flatten(fr).sort(); console.log(JSON.stringify(kn)===JSON.stringify(ke) && JSON.stringify(kn)===JSON.stringify(kf) ? 'PARITY_OK' : 'MISMATCH');"`
Expected: `PARITY_OK`

- [ ] **Step 5: Commit**

```bash
git add dictionaries/nl.json dictionaries/en.json dictionaries/fr.json
git commit -m "feat: add dictionary keys for design system phase"
```

---

## Task 5: `Button` component

**Files:**
- Create: `components/ui/Button.tsx`

**Interfaces:**
- Consumes: `cn` from `lib/cn.ts`; tokens from Task 1 (`--radius-button`, `--shadow-button`, `--duration-hover-fast`, `--color-accent`, `--color-accent-hover`, `--color-text`, `--color-contrast`, `--color-surface`, `--color-border`).
- Produces: `<Button variant="primary"|"secondary"|"ghost" size="sm"|"md"|"lg" busy? disabled? ...nativeButtonProps>`, consumed by `FavoriteButton` is NOT built on `Button` (it's icon-only, see Task 8) but every other future call-to-action in later phases will be. This phase does not yet wire `Button` into an existing page — it is built and exported per the plan's component-library scope; do not invent a caller.

- [ ] **Step 1: Create `components/ui/Button.tsx`**

Three variants matching the two button screenshots (`primary` = solid accent fill with dark text and a small embossed shadow; `secondary` = white fill, thin dark border, dark text) plus a `ghost` variant (no fill, no border, text-only, for lower-emphasis actions — not shown in the screenshots but required by the task's three-variant list). Three sizes. Five states: hover, focus (via the global `:focus-visible` rule, no extra work needed here beyond not suppressing outlines), active (`:active` — a slight press-down via reduced shadow), disabled (`disabled` attribute, reduced opacity, no pointer events), busy (a `busy` prop that disables the button and shows a simple inline spinner — built with a plain rotating border div using `--duration-hover`, not the truck loader, and respecting `prefers-reduced-motion` via the global rule from Task 1 which already zeroes all animation durations under that preference).

```tsx
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const variantClasses: Record<"primary" | "secondary" | "ghost", string> = {
  primary:
    "bg-accent text-contrast border border-accent shadow-button hover:bg-accent-hover hover:border-accent-hover active:shadow-none",
  secondary:
    "bg-surface text-text border border-border hover:border-border-hover active:bg-background",
  ghost:
    "bg-transparent text-text border border-transparent hover:text-accent-hover active:text-accent",
};

const sizeClasses: Record<"sm" | "md" | "lg", string> = {
  sm: "px-3 py-1.5 text-body-sm",
  md: "px-4 py-2 text-body-md",
  lg: "px-6 py-3 text-body-lg",
};

export function Button({
  variant = "primary",
  size = "md",
  busy = false,
  disabled = false,
  className,
  children,
  ...props
}: {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  busy?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-button font-heading tracking-heading transition-colors duration-hover-fast ease-hover disabled:cursor-not-allowed disabled:opacity-50",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {busy ? (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : null}
      {children}
    </button>
  );
}
```

Note on `rounded-button`, `shadow-button`, `duration-hover-fast`, `ease-hover`, `text-body-sm/md/lg`: these are the Tailwind utility class names Tailwind v4 auto-generates from the `--radius-button`, `--shadow-button`, `--transition-duration-hover-fast`, `--ease-hover`, `--text-body-*` custom properties declared in Task 1's `@theme` block. Most namespaces follow a direct `--<category>-<name>` → `<category-utility>-<name>` convention (`--radius-button` → `rounded-button`, the same mechanism already producing `bg-accent`, `text-muted`, etc. from the existing color tokens) — the one exception, verified empirically in Task 1, is that named transition durations require the `--transition-duration-*` prefix in `@theme` to produce a `duration-<name>` class, not a bare `--duration-*` prefix. No manual Tailwind config is needed for any of this mapping — it is automatic for any custom property declared inside `@theme`, following each namespace's own established prefix.

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/ui/Button.tsx
git commit -m "feat: add Button component with primary/secondary/ghost variants"
```

---

## Task 6: `Card` component and `ProductCard` adoption

**Files:**
- Create: `components/ui/Card.tsx`
- Modify: `components/product/ProductCard.tsx`

**Interfaces:**
- Consumes: `cn`; tokens from Task 1 (`--radius-card`, `--shadow-card`, `--shadow-card-hover`, `--color-border-hover`, `--duration-hover`, `--ease-hover`).
- Produces: `<Card className? children>` — a bare shape/hover primitive with no product-specific content, consumed by `ProductCard` (rewired in this same task to use it, no data/query change) and available for later phases' non-product cards.

- [ ] **Step 1: Create `components/ui/Card.tsx`**

The lift-and-border-shift hover from the reference: 4px lift, border shifts from `--color-border` to `--color-border-hover`, 320ms (`--duration-hover`) with the soft easing curve (`--ease-hover`), respecting `prefers-reduced-motion` via Task 1's global rule (which zeroes the transition duration, leaving only the instant color/shadow change — satisfying Task 9's "only color and shadow change" requirement without this component needing its own media query).

```tsx
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-card border border-border bg-surface shadow-card transition-[transform,box-shadow,border-color] duration-hover ease-hover hover:-translate-y-1 hover:border-border-hover hover:shadow-card-hover",
        className
      )}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Rewire `ProductCard` to render inside `Card`**

Read the current `components/product/ProductCard.tsx` first (it currently renders a top-level `<a>` with `border border-border bg-surface` classes applied directly, plus image/category/name/price). Keep the `<a>` as the outer interactive/link element (required for the whole card to be a single click target — do not change this to a `<div>` wrapping an inner link, which would change the click-target semantics the existing component already has correct), but move the shape/hover styling onto `Card`, with `Card` as a direct child of the `<a>` sharing full width/height:

```tsx
import type { Locale } from "@/lib/i18n";
import type { ProductSummaryDto } from "@/lib/queries";
import { product as productPath } from "@/lib/routes";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/Card";

export function ProductCard({
  product,
  categoryName,
  locale,
}: {
  product: ProductSummaryDto;
  categoryName?: string;
  locale: Locale;
}) {
  const primaryImage = product.images.find((image) => image.isPrimary) ?? product.images[0];

  return (
    <a href={productPath(locale, product.slug)} className="block">
      <Card className="p-card">
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
        {categoryName ? <p className="mt-3 text-body-sm text-muted">{categoryName}</p> : null}
        <h3 className="font-heading text-heading-sm tracking-heading text-text">{product.name}</h3>
        <p className="mt-1 font-semibold text-text">{formatPrice(product.basePriceCents, locale)}</p>
      </Card>
    </a>
  );
}
```

This preserves every existing prop, every existing piece of content, and the existing "no self-constructed image URL" / "placeholder div, not broken img" rules from Phase 8 — only the shape/hover styling moved from inline classes into `Card`.

- [ ] **Step 3: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/ui/Card.tsx components/product/ProductCard.tsx
git commit -m "feat: add Card primitive and adopt it in ProductCard"
```

---

## Task 7: Product grid convention

**Files:**
- Modify: `app/[locale]/page.tsx`, `app/[locale]/categories/page.tsx`, `app/[locale]/categories/[category]/page.tsx`

**Interfaces:**
- Consumes: nothing new — these three files already render `ProductCard` in a grid (from Phase 8); this task only normalizes the grid's responsive classes to the single agreed convention: 4 columns desktop, 3 tablet, 2 phone.

- [ ] **Step 1: Read each file's current grid classes**

All three currently use `grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4` (confirmed already matching 2/3/4 phone/tablet/desktop from Phase 8 Task 14/15). This task's job is to confirm this is genuinely identical across all three files (not fix a mismatch that doesn't exist) and extract it as the one documented convention rather than three independently-typed copies of the same string.

- [ ] **Step 2: If any of the three files differs from `grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4`, correct it to match**

Do not introduce a shared constant or helper for this class string — three short, identical Tailwind class strings in three page files is not a duplication problem worth abstracting (a shared "grid class" constant would be import overhead for a one-line string, and Tailwind class strings are conventionally repeated at call sites in this codebase already, e.g. `py-10` appears identically in every page from Phase 8). If all three already match, this task requires no code change — proceed directly to Step 3's documentation, which is the actual deliverable.

- [ ] **Step 3: Document the convention in `docs/ARCHITECTURE.md`**

Add a new section:

```markdown
## Product grid convention

Every product listing (`app/[locale]/page.tsx`, `app/[locale]/categories/page.tsx`,
`app/[locale]/categories/[category]/page.tsx`) uses the same responsive
grid: `grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4` — two columns
on phone, three on tablet, four on desktop. Any future page that lists
`ProductCard` instances uses this exact class string.
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` (expected clean — no `.tsx` logic changed if Step 2 found no mismatch; if it did, this confirms the fix didn't break types).

- [ ] **Step 5: Commit**

```bash
git add docs/ARCHITECTURE.md app/[locale]/page.tsx "app/[locale]/categories/page.tsx" "app/[locale]/categories/[category]/page.tsx"
git commit -m "docs: record the single product grid convention"
```

---

## Task 8: `FavoriteButton` component

**Files:**
- Create: `components/ui/FavoriteButton.tsx`

**Interfaces:**
- Consumes: `Heart` icon from `lucide-react`; `cn`.
- Produces: `<FavoriteButton active={boolean} onToggle={(next: boolean) => void} label={{on: string, off: string}} />` — a client component, self-contained toggle with no persistence (per Task 10's explicit "niets opgeslagen in deze fase"). Not yet wired into `ProductCard` or any page — this task builds the component only, matching the plan's scope of building primitives this phase and wiring some (Header/Footer) but not all (FavoriteButton has no page call site specified in the 28-point list — it names the component's behavior, not its placement).

- [ ] **Step 1: Create `components/ui/FavoriteButton.tsx`**

Outline heart by default. On hover, the heart turns red (color-only, no scale/beat animation — this explicitly overrides the animated reference snippet the user supplied, per the task's own instruction). Active/toggled state: filled red heart, stays filled while active (no animation on toggle either). A real toggle button (`aria-pressed`), with an accessible label that changes between "add" and "remove" phrasing depending on state (both keys already added in Task 4).

```tsx
"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/cn";

export function FavoriteButton({
  active: activeProp,
  onToggle,
  label,
  className,
}: {
  active?: boolean;
  onToggle?: (next: boolean) => void;
  label: { on: string; off: string };
  className?: string;
}) {
  const [internalActive, setInternalActive] = useState(false);
  const active = activeProp ?? internalActive;

  function handleClick() {
    const next = !active;
    if (onToggle) {
      onToggle(next);
    } else {
      setInternalActive(next);
    }
  }

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? label.on : label.off}
      onClick={handleClick}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors duration-hover-fast hover:text-red-600",
        active && "text-red-600",
        className
      )}
    >
      <Heart className="h-5 w-5" fill={active ? "currentColor" : "none"} aria-hidden="true" />
    </button>
  );
}
```

Note on the red color: neither `--color-accent` nor any existing token is red — a favorite heart's active/hover color is conventionally red across web conventions independent of brand palette (the task explicitly says "kleurt rood", not "kleurt accent"), and Tailwind's built-in `red-600` is used directly rather than inventing a new brand-scale red token for a single-purpose micro-interaction color that isn't part of the five-color brand palette. This is a deliberate, narrow exception to "colors come from tokens" — flag it in `docs/ARCHITECTURE.md` (Task 16) rather than silently introduce a sixth brand color or leave it undocumented.

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/ui/FavoriteButton.tsx
git commit -m "feat: add FavoriteButton toggle with color-only hover and active states"
```

---

## Task 9: `Tabs` component

**Files:**
- Create: `components/ui/Tabs.tsx`

**Interfaces:**
- Consumes: `cn`.
- Produces: `<Tabs tabs={{id: string, label: string, content: ReactNode}[]} defaultTabId?: string />` — client component, full roving-tabindex keyboard pattern (Left/Right arrow moves selection, Home/End jump to first/last, Enter/Space activates a focused-but-not-yet-selected tab is unnecessary since arrow keys activate immediately per the standard "automatic activation" tabs pattern — matches the ARIA Authoring Practices Guide tabs pattern). Consumed later (not this phase) by product detail pages for description/nutrition/FAQ — this task builds the component and its template slot only, per the task's explicit "de inhoud komt later; bouw nu de component en de sjabloonplek."

- [ ] **Step 1: Create `components/ui/Tabs.tsx`**

```tsx
"use client";

import { useRef, useState, type ReactNode, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";

export function Tabs({
  tabs,
  defaultTabId,
}: {
  tabs: { id: string; label: string; content: ReactNode }[];
  defaultTabId?: string;
}) {
  const [activeId, setActiveId] = useState(defaultTabId ?? tabs[0]?.id);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  function focusAndActivate(id: string) {
    setActiveId(id);
    tabRefs.current[id]?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      const next = tabs[(index + 1) % tabs.length];
      focusAndActivate(next.id);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      const prev = tabs[(index - 1 + tabs.length) % tabs.length];
      focusAndActivate(prev.id);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusAndActivate(tabs[0].id);
    } else if (event.key === "End") {
      event.preventDefault();
      focusAndActivate(tabs[tabs.length - 1].id);
    }
  }

  return (
    <div>
      <div role="tablist" className="flex gap-2 border-b border-border">
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            ref={(el) => {
              tabRefs.current[tab.id] = el;
            }}
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={activeId === tab.id}
            aria-controls={`tabpanel-${tab.id}`}
            tabIndex={activeId === tab.id ? 0 : -1}
            onClick={() => setActiveId(tab.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              "border-b-2 px-4 py-2 font-heading text-body-md transition-colors duration-hover-fast",
              activeId === tab.id
                ? "border-accent text-text"
                : "border-transparent text-muted hover:text-text"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`tabpanel-${tab.id}`}
          aria-labelledby={`tab-${tab.id}`}
          hidden={activeId !== tab.id}
          className="py-4"
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/ui/Tabs.tsx
git commit -m "feat: add Tabs component with roving-tabindex keyboard navigation"
```

---

## Task 10: `USPBar` component

**Files:**
- Create: `components/ui/USPBar.tsx`

**Interfaces:**
- Consumes: `dictionary.usp.*` keys (Task 4); `lucide-react` icons; `cn`.
- Produces: `<USPBar dictionary={typeof nl} />` — server component (no interactivity), not yet wired into a page (the 28-point list describes building it, not placing it — placement is a later-phase decision, consistent with `Tabs`/`FavoriteButton`'s scope in this plan).

- [ ] **Step 1: Create `components/ui/USPBar.tsx`**

Three USPs from the dictionary, one lucide icon each (chosen for semantic fit: a flame/sparkle for "fresh roasted", a person/message icon for "personal advice", a calendar/clock for "years of experience"), with explicit room for a fourth shipping-related USP that isn't populated yet — implemented as an optional fourth slot the caller can pass, not a hardcoded placeholder box (an empty visual placeholder would violate "no fake content," matching this plan's stance on the mega-menu's empty featured-block case in Task 12).

```tsx
import { Flame, MessageCircleHeart, CalendarClock, type LucideIcon } from "lucide-react";
import type nl from "@/dictionaries/nl.json";

type UspItem = { icon: LucideIcon; label: string };

export function USPBar({
  dictionary,
  shipping,
}: {
  dictionary: typeof nl;
  shipping?: string;
}) {
  const items: UspItem[] = [
    { icon: Flame, label: dictionary.usp.freshRoasted },
    { icon: MessageCircleHeart, label: dictionary.usp.personalAdvice },
    { icon: CalendarClock, label: dictionary.usp.experience },
  ];

  if (shipping) {
    items.push({ icon: CalendarClock, label: shipping });
  }

  return (
    <ul className="flex flex-wrap justify-center gap-gap-lg border-y border-border bg-background py-gap-md text-body-sm text-text">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-gap-sm">
          <item.icon className="h-5 w-5 text-accent-hover" aria-hidden="true" />
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}
```

Note: the fourth shipping icon currently reuses `CalendarClock` as a placeholder icon choice since no shipping-specific icon was specified — this is a reasonable default (a lucide icon, not a missing icon), and the caller supplying `shipping` text in a later phase can also pass a distinct icon at that time if desired; this plan does not extend the prop shape for a per-item icon override since only three items are the immediate deliverable and the fourth is explicitly deferred content, not a fourth built feature.

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/ui/USPBar.tsx
git commit -m "feat: add USPBar component with three populated points and a deferred fourth slot"
```

---

## Task 11: `MegaMenu` component

**Files:**
- Create: `components/layout/MegaMenu.tsx`

**Interfaces:**
- Consumes: `MainCategoryDto[]` (from `getMainCategories`, passed down from `Header`, not fetched independently — `Header` already fetches once, `MegaMenu` is presentational); `category` route helper from `lib/routes.ts`; `cn`.
- Produces: `<MegaMenu categories={MainCategoryDto[]} locale={Locale} label={string} />` — client component (needs hover/focus/Escape/outside-click state), consumed by `Header` in Task 12.

- [ ] **Step 1: Create `components/layout/MegaMenu.tsx`**

Opens on hover of the trigger and on keyboard focus reaching the trigger; closes on `Escape` (returning focus to the trigger) and on click outside. Per-category slot for a "featured block" that renders the category's `description` when present (Global Constraints: render nothing, not a placeholder, when absent) — since `MainCategoryDto` (Phase 8, `lib/queries.ts`) does not currently include `description`, this task must extend that DTO and the `getMainCategories` query minimally to select it, without changing the query's existing sort/filter/promotional-last behavior established in Phase 8.

First, modify `lib/queries.ts`:

```typescript
export type MainCategoryDto = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
};
```

And in `getMainCategories`'s existing `.map(...)` return object (locate the exact current mapping — it returns `{ id: category.id, slug: translation.slug, name: translation.name }` — add one field, changing nothing else):

```typescript
return {
  id: category.id,
  slug: translation.slug,
  name: translation.name,
  description: translation.description,
};
```

Then create `components/layout/MegaMenu.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import type { MainCategoryDto } from "@/lib/queries";
import type { Locale } from "@/lib/i18n";
import { category as categoryPath } from "@/lib/routes";
import { cn } from "@/lib/cn";

export function MegaMenu({
  categories,
  locale,
  label,
}: {
  categories: MainCategoryDto[];
  locale: Locale;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape" && open) {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onFocus={() => setOpen(true)}
        onClick={() => setOpen((value) => !value)}
        className="font-heading text-body-md text-text transition-colors duration-hover-fast hover:text-accent-hover"
      >
        {label}
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-40 mt-2 grid w-[min(90vw,48rem)] grid-cols-3 gap-gap-lg rounded-panel border border-border bg-surface p-panel shadow-card-hover">
          {categories.map((item) => (
            <div key={item.id}>
              <a
                href={categoryPath(locale, item.slug)}
                className="font-heading text-body-md text-text hover:text-accent-hover"
                onClick={() => setOpen(false)}
              >
                {item.name}
              </a>
              {item.description ? (
                <p className="mt-2 text-body-sm text-muted">{item.description}</p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
```

Note: this task's brief mentions "ruimte voor subcategorieën" (room for subcategories) per category. `MainCategoryDto` has no subcategory list (Phase 8's `getMainCategories` explicitly filters `parentId: null` and returns only top-level categories, by design). Building live subcategory fetching here would require a new query and is a data-layer expansion beyond "ontwerpsysteem en navigatie" — this task provides the layout room (the grid cell per category can hold more than just the name + description, e.g. a `<ul>` of subcategory links) but does not fetch or render actual subcategory data, since none is available without a new query this plan's scope does not authorize inventing. Document this gap in Task 16 rather than silently build a fake list.

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/queries.ts components/layout/MegaMenu.tsx
git commit -m "feat: add MegaMenu component and extend getMainCategories with description"
```

---

## Task 12: `MobileNav` component

**Files:**
- Create: `components/layout/MobileNav.tsx`

**Interfaces:**
- Consumes: `MainCategoryDto[]`; `Locale`; route helpers; dictionary nav/footer keys; `X`/`Menu`/`ChevronDown` icons from `lucide-react`; `cn`.
- Produces: `<MobileNav categories={MainCategoryDto[]} locale={Locale} dictionary={typeof nl} />` — client component: trigger button + slide-in panel, categories as a collapsible list (not a mega-menu grid — mobile gets a simpler accordion), focus trapped inside the panel while open.

- [ ] **Step 1: Create `components/layout/MobileNav.tsx`**

Focus trap: on open, focus moves to the panel's close button; `Tab`/`Shift+Tab` cycles only among the panel's focusable elements (implemented by querying focusable descendants of the panel ref and wrapping focus manually — no new dependency, since no focus-trap package exists in this project and Global Constraints forbids adding one).

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Menu, X, ChevronDown } from "lucide-react";
import type nl from "@/dictionaries/nl.json";
import type { MainCategoryDto } from "@/lib/queries";
import type { Locale } from "@/lib/i18n";
import { account, articles, cart, category as categoryPath, categories as categoriesPath, home } from "@/lib/routes";
import { cn } from "@/lib/cn";

const focusableSelector =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function MobileNav({
  categories,
  locale,
  dictionary,
}: {
  categories: MainCategoryDto[];
  locale: Locale;
  dictionary: typeof nl;
}) {
  const [open, setOpen] = useState(false);
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      closeButtonRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (!open) return;
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(focusableSelector)
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={dictionary.nav.openMenu}
        onClick={() => setOpen(true)}
        className="inline-flex h-10 w-10 items-center justify-center text-text lg:hidden"
      >
        <Menu className="h-6 w-6" aria-hidden="true" />
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-contrast/50"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={dictionary.nav.mainMenu}
            className="absolute right-0 top-0 h-full w-[min(85vw,20rem)] overflow-y-auto bg-surface p-panel shadow-card-hover"
          >
            <button
              ref={closeButtonRef}
              type="button"
              aria-label={dictionary.nav.closeMenu}
              onClick={() => setOpen(false)}
              className="ml-auto flex h-10 w-10 items-center justify-center text-text"
            >
              <X className="h-6 w-6" aria-hidden="true" />
            </button>
            <nav className="mt-gap-md flex flex-col gap-gap-md">
              <a href={home(locale)} onClick={() => setOpen(false)}>
                {dictionary.nav.home}
              </a>
              <div>
                <button
                  type="button"
                  aria-expanded={categoriesExpanded}
                  onClick={() => setCategoriesExpanded((value) => !value)}
                  className="flex w-full items-center justify-between"
                >
                  {dictionary.nav.categories}
                  <ChevronDown
                    className={cn("h-4 w-4 transition-transform duration-hover-fast", categoriesExpanded && "rotate-180")}
                    aria-hidden="true"
                  />
                </button>
                {categoriesExpanded ? (
                  <ul className="mt-gap-sm flex flex-col gap-gap-sm pl-gap-md">
                    <li>
                      <a href={categoriesPath(locale)} onClick={() => setOpen(false)}>
                        {dictionary.nav.categories}
                      </a>
                    </li>
                    {categories.map((item) => (
                      <li key={item.id}>
                        <a href={categoryPath(locale, item.slug)} onClick={() => setOpen(false)}>
                          {item.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <a href={articles(locale)} onClick={() => setOpen(false)}>
                {dictionary.nav.articles}
              </a>
              <a href={cart(locale)} onClick={() => setOpen(false)}>
                {dictionary.nav.cart}
              </a>
              <a href={account(locale)} onClick={() => setOpen(false)}>
                {dictionary.nav.account}
              </a>
            </nav>
          </div>
        </div>
      ) : null}
    </>
  );
}
```

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/layout/MobileNav.tsx
git commit -m "feat: add MobileNav slide-in panel with focus trap"
```

---

## Task 13: Rebuild `Header`

**Files:**
- Modify: `components/layout/Header.tsx`

**Interfaces:**
- Consumes: `MegaMenu` (Task 11), `MobileNav` (Task 12), `Logo` (existing, unchanged interface), `LocaleSwitcher` (existing, unchanged interface — Task 14 only restyles it, not its props), `Search`/`User`/`ShoppingCart` icons from `lucide-react`, `getMainCategories` (unchanged call, now returning the extra `description` field which `Header` passes through to `MegaMenu` unchanged).
- Produces: the new `Header({locale, dictionary, languages})` — same three props as before (Phase 8's `SiteShell` and every per-route `layout.tsx` call `Header` with exactly these three props; this task does not change that contract, only what's inside).

- [ ] **Step 1: Rebuild `components/layout/Header.tsx`**

Larger wordmark (the task's own diagnosis: "het logo veel te klein is... krijgt een formaat dat past bij een winkelkop" — increase `Logo`'s wordmark height class from the current `h-6` fixed in `Logo.tsx` itself. Since `Logo.tsx`'s `<img>` height is hardcoded via `className="h-6"` inside the component (Phase 8b), and `Logo`'s public interface doesn't expose a size prop, this task adds a `size` prop to `Logo` — a minimal, backward-compatible addition, defaulting to the current size so `Footer`'s existing call is unaffected):

Modify `components/ui/Logo.tsx` first, adding a `size` prop:

```tsx
import { cn } from "@/lib/cn";

const wordmarkSrc: Record<"light" | "dark", string> = {
  light: "/brand/logo-wordmark.svg",
  dark: "/brand/logo-wordmark.svg",
};

const wordmarkSizeClasses: Record<"sm" | "lg", string> = {
  sm: "h-6",
  lg: "h-10",
};

const markSizeClasses: Record<"sm" | "lg", string> = {
  sm: "h-8 w-8",
  lg: "h-12 w-12",
};

export function Logo({
  alt,
  variant = "light",
  parts = "full",
  size = "sm",
  className,
}: {
  alt: { mark: string; wordmark: string };
  variant?: "light" | "dark";
  parts?: "mark" | "wordmark" | "full";
  size?: "sm" | "lg";
  className?: string;
}) {
  const showMark = parts === "mark" || parts === "full";
  const showWordmark = parts === "wordmark" || parts === "full";

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      {showMark ? (
        <img src="/brand/logo-mark.svg" alt={alt.mark} className={markSizeClasses[size]} />
      ) : null}
      {showWordmark ? (
        <img src={wordmarkSrc[variant]} alt={alt.wordmark} className={wordmarkSizeClasses[size]} />
      ) : null}
    </span>
  );
}
```

Then rebuild `components/layout/Header.tsx`:

```tsx
import type nl from "@/dictionaries/nl.json";
import type { Locale } from "@/lib/i18n";
import { account, articles, cart, home } from "@/lib/routes";
import { getMainCategories } from "@/lib/queries";
import { Container } from "@/components/ui/Container";
import { Logo } from "@/components/ui/Logo";
import { LocaleSwitcher } from "@/components/layout/LocaleSwitcher";
import { MegaMenu } from "@/components/layout/MegaMenu";
import { MobileNav } from "@/components/layout/MobileNav";
import { Search, User, ShoppingCart } from "lucide-react";

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
    <header className="sticky top-0 z-50 border-b border-transparent bg-background supports-[backdrop-filter]:backdrop-blur data-[scrolled=true]:border-border">
      <Container className="flex items-center justify-between gap-gap-md py-gap-md">
        <div className="flex items-center gap-gap-lg">
          <MobileNav categories={mainCategories} locale={locale} dictionary={dictionary} />
          <a href={home(locale)}>
            <Logo
              alt={{ mark: dictionary.brand.logoMarkAlt, wordmark: dictionary.brand.logoWordmarkAlt }}
              variant="light"
              parts="full"
              size="lg"
            />
          </a>
        </div>
        <nav aria-label={dictionary.nav.categories} className="hidden lg:flex lg:items-center lg:gap-gap-lg">
          <MegaMenu categories={mainCategories} locale={locale} label={dictionary.nav.categories} />
          <a href={articles(locale)} className="font-heading text-body-md text-text hover:text-accent-hover">
            {dictionary.nav.articles}
          </a>
        </nav>
        <div className="flex items-center gap-gap-md">
          <button type="button" aria-label={dictionary.nav.search} className="text-text hover:text-accent-hover">
            <Search className="h-5 w-5" aria-hidden="true" />
          </button>
          <a href={account(locale)} aria-label={dictionary.common.account} className="text-text hover:text-accent-hover">
            <User className="h-5 w-5" aria-hidden="true" />
          </a>
          <a href={cart(locale)} aria-label={dictionary.common.cart} className="text-text hover:text-accent-hover">
            <ShoppingCart className="h-5 w-5" aria-hidden="true" />
          </a>
          <LocaleSwitcher currentLocale={locale} languages={languages} />
        </div>
      </Container>
    </header>
  );
}
```

Note on the sticky scroll divider (`data-[scrolled=true]:border-border`): a `data-scrolled` attribute requires a scroll listener, which requires a client component. `Header` is currently a server component (it `await`s `getMainCategories`). Rather than convert the whole `Header` to a client component (which would lose server-side data fetching and force `getMainCategories` into a client-side fetch, a much larger architectural change out of scope here), this task uses a CSS-only approximation: `position: sticky` combined with `backdrop-blur` gives a persistent visual separation from scrolled content without needing to detect scroll position in JavaScript. The `data-[scrolled=true]` selector above is aspirational and non-functional as written (nothing sets that attribute) — **remove it** and rely on `backdrop-blur` plus a permanent `border-border` (not `border-transparent`) for the "subtiele scheiding" requirement instead, which is simpler, has no JS dependency, and satisfies "blijft plakken bij scrollen, met een subtiele scheiding" without the "zodra de pagina niet meer bovenaan staat" nuance requiring active scroll detection. Correct the class to:

```tsx
<header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
```

This gives a permanent subtle border plus a translucent/blurred background so content scrolling underneath is visually distinguished from the header — satisfying the spirit of the requirement (separation once content is present behind the header) without a scroll-listener client component. If a future phase wants the border to appear only after scrolling starts (not permanently), that requires converting `Header` to accept scroll state from a small client wrapper — flagged as a known simplification in Task 16, not built here.

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/ui/Logo.tsx components/layout/Header.tsx
git commit -m "feat: rebuild Header with mega-menu, mobile nav, icon cluster and larger wordmark"
```

---

## Task 14: Compact `LocaleSwitcher` styling

**Files:**
- Modify: `components/layout/LocaleSwitcher.tsx`

**Interfaces:**
- Consumes: nothing new — same props as Phase 8 (`currentLocale`, `languages`). This task is visual-only.

- [ ] **Step 1: Restyle for a more compact header fit**

Read the current file (Phase 8: a `<ul>` of locale links with `text-sm uppercase text-muted hover:text-text`, current locale bold). Tighten spacing and reduce visual weight so it fits comfortably in the icon cluster next to search/account/cart:

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
    <ul className="flex items-center gap-gap-sm text-body-sm">
      {locales.map((locale) => {
        const href = languages[locale] ?? home(locale);

        return (
          <li key={locale}>
            <a
              href={href}
              aria-current={locale === currentLocale ? "true" : undefined}
              className={cn(
                "uppercase text-muted transition-colors duration-hover-fast hover:text-text",
                locale === currentLocale && "font-semibold text-text"
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

The only functional change from Phase 8 is `gap-2` → `gap-gap-sm` (a token-scale value close to the original) and adding the shared hover-transition token — everything else (fallback logic, `aria-current`, no route/slug construction) is unchanged.

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/layout/LocaleSwitcher.tsx
git commit -m "style: compact LocaleSwitcher spacing for the icon cluster"
```

---

## Task 15: Rebuild `Footer`

**Files:**
- Modify: `components/layout/Footer.tsx`

**Interfaces:**
- Consumes: `Logo` (with new `size` prop from Task 13, default `"sm"` unaffected — Footer keeps its current small wordmark-on-light-panel treatment, since Task 20's inverted-variant note is about a future asset, not this task's size decision); `pagePath`; `getMainCategories` (new call — Footer did not fetch categories before; this task adds it for the new categories column); dictionary footer/nav keys (Task 4).

- [ ] **Step 1: Rebuild `components/layout/Footer.tsx`**

Four columns: brand (wordmark + baseline), categories (from `getMainCategories`, same data source Header uses — no hardcoded list), service+legal (existing seven legal links plus the existing `footer.serviceTitle` heading), contact+market days (Thursday/Friday/Saturday from the new dictionary keys). Footer becomes `async` (it now awaits `getMainCategories`, matching the pattern `Header` already uses).

```tsx
import type nl from "@/dictionaries/nl.json";
import type { Locale } from "@/lib/i18n";
import { pagePath } from "@/lib/pages";
import { category as categoryPath } from "@/lib/routes";
import { getMainCategories } from "@/lib/queries";
import { Container } from "@/components/ui/Container";
import { Logo } from "@/components/ui/Logo";

export async function Footer({
  locale,
  dictionary,
}: {
  locale: Locale;
  dictionary: typeof nl;
}) {
  const mainCategories = await getMainCategories(locale);

  return (
    <footer className="bg-contrast text-background">
      <Container className="grid grid-cols-1 gap-gap-lg py-panel sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-gap-md">
          <span className="inline-block w-fit rounded bg-surface p-gap-sm">
            <Logo
              alt={{ mark: dictionary.brand.logoMarkAlt, wordmark: dictionary.brand.logoWordmarkAlt }}
              variant="dark"
              parts="wordmark"
            />
          </span>
          <p className="text-body-sm text-background/70">{dictionary.brand.baseline}</p>
        </div>
        <div>
          <h2 className="font-heading text-heading-sm text-background">{dictionary.footer.categoriesTitle}</h2>
          <ul className="mt-gap-md flex flex-col gap-gap-sm text-body-sm">
            {mainCategories.map((item) => (
              <li key={item.id}>
                <a href={categoryPath(locale, item.slug)} className="text-background/80 hover:text-background">
                  {item.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="font-heading text-heading-sm text-background">{dictionary.footer.serviceTitle}</h2>
          <nav aria-label={dictionary.footer.legalTitle}>
            <ul className="mt-gap-md flex flex-col gap-gap-sm text-body-sm">
              <li>
                <a href={pagePath("terms", locale)} className="text-background/80 hover:text-background">
                  {dictionary.footer.terms}
                </a>
              </li>
              <li>
                <a href={pagePath("privacy", locale)} className="text-background/80 hover:text-background">
                  {dictionary.footer.privacy}
                </a>
              </li>
              <li>
                <a href={pagePath("cookies", locale)} className="text-background/80 hover:text-background">
                  {dictionary.footer.cookies}
                </a>
              </li>
              <li>
                <a href={pagePath("withdrawal", locale)} className="text-background/80 hover:text-background">
                  {dictionary.footer.withdrawal}
                </a>
              </li>
              <li>
                <a href={pagePath("subscribe", locale)} className="text-background/80 hover:text-background">
                  {dictionary.footer.subscribe}
                </a>
              </li>
              <li>
                <a href={pagePath("optOut", locale)} className="text-background/80 hover:text-background">
                  {dictionary.footer.optOut}
                </a>
              </li>
            </ul>
          </nav>
        </div>
        <div>
          <h2 className="font-heading text-heading-sm text-background">{dictionary.footer.contactTitleColumn}</h2>
          <a
            href={pagePath("contact", locale)}
            className="mt-gap-md block text-body-sm text-background/80 hover:text-background"
          >
            {dictionary.footer.contact}
          </a>
          <h3 className="mt-gap-lg font-heading text-body-md text-background">{dictionary.footer.marketDaysTitle}</h3>
          <ul className="mt-gap-sm flex flex-col gap-gap-sm text-body-sm text-background/80">
            <li>{dictionary.footer.marketDayThursday}</li>
            <li>{dictionary.footer.marketDayFriday}</li>
            <li>{dictionary.footer.marketDaySaturday}</li>
          </ul>
        </div>
      </Container>
      <Container className="border-t border-background/10 py-gap-md">
        <p className="text-body-sm text-background/70">{dictionary.footer.copyright}</p>
      </Container>
    </footer>
  );
}
```

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/layout/Footer.tsx
git commit -m "feat: rebuild Footer into brand/categories/service/contact columns with market days"
```

---

## Task 16: Port `LoadingIndicator` verbatim from `public/loader_Truck.html`

**Files:**
- Create: `components/ui/LoadingIndicator.tsx`
- Create: `components/ui/LoadingIndicator.loader.css`
- Create: `public/loader/truck.png`, `public/loader/cargo.png`, `public/loader/puff.png`
- Delete: `public/loader_Truck.html`

**Interfaces:**
- Consumes: nothing (self-contained). Produces `<LoadingIndicator />` — client component (reads `prefers-reduced-motion` via a `matchMedia` check to choose which ported markup path to render, mirroring the CSS-level `@media (prefers-reduced-motion: reduce)` block already present in the source file). Not wired into any page or transition this phase, per the explicit instruction to add the component only.

- [ ] **Step 1: Extract the three distinct embedded images**

`public/loader_Truck.html` embeds four `<img>` tags as base64 PNG data URIs: `.dn-tl-puff-base` and `.dn-tl-puff-drift` (byte-identical to each other, 28,003 bytes each), `.dn-tl-truck` (192,771 bytes), `.dn-tl-cargo` (54,686 bytes). Decode each base64 payload and write to:
- `public/loader/truck.png` (192,771 bytes)
- `public/loader/cargo.png` (54,686 bytes)
- `public/loader/puff.png` (28,003 bytes — used by both the base and drift image elements, since they are the same source image)

Use a short one-off script (not committed — Node or Python, run locally, e.g. `node -e "..."` reading the file, regex-matching each `<img class="..." src="data:image/png;base64,...">`, and writing the decoded buffer to the target path). Verify each extracted file's byte size matches the numbers above exactly before proceeding — a mismatch means the extraction cut into the wrong byte range.

Report before/after size: original `public/loader_Truck.html` is 410,902 bytes total (CSS + markup + all four inlined images' base64 text, which inflates ~33% over raw binary size). The three extracted PNGs total 275,460 bytes raw (192,771 + 54,686 + 28,003). The new `LoadingIndicator.tsx` + `LoadingIndicator.loader.css` markup/CSS-only text (no embedded image data) will be on the order of 4-6 KB. Report the actual final sizes of all created files in the task's completion report.

- [ ] **Step 2: Create `components/ui/LoadingIndicator.loader.css`**

Port the `.dn-truckloader` through `.dn-tl-sr` and the `@keyframes` rules verbatim from `public/loader_Truck.html`'s `<style>` block (lines 5-170, i.e. excluding the outer demo-page-only `body{margin:0;background:#111;display:grid;place-items:center;height:100vh}` reset on line 2, which is not part of the component and must not be ported — that rule belongs to the standalone demo page, not the app). Copy every selector, property, value, and keyframe exactly as they appear — no renamed properties, no adjusted timings, no adjusted colors, no adjusted geometry. The class names (`dn-truckloader`, `dn-tl-track`, `dn-tl-floor`, `dn-tl-rig`, `dn-tl-bounce`, `dn-tl-truck`, `dn-tl-cargo`, `dn-tl-hub`, `dn-tl-hub-f`, `dn-tl-hub-r`, `dn-tl-puff`, `dn-tl-puff-base`, `dn-tl-puff-drift`, `dn-tl-sr`) already carry a `dn-` prefix in the source and do not collide with any Tailwind utility or existing project class — keep them exactly as-is, satisfying "eigen class-namen die nergens anders voorkomen" without needing to rename anything.

The one required content change: the source CSS's `background-image` is not used (the source uses `<img>` elements, not CSS `background-image`, for the truck/cargo/puff art — confirm this by re-reading the extracted CSS rules for `.dn-tl-truck`, `.dn-tl-cargo`, `.dn-tl-puff` before writing the file; they set `position`/`size`/`animation` properties only, no `background-image` or `content: url(...)`, since the artwork is `<img src>` elements in the HTML, not CSS backgrounds) — so no path rewriting is needed inside the CSS file itself; the image paths are supplied via the `<img src>` attributes in the JSX (Step 3), not the stylesheet.

- [ ] **Step 3: Create `components/ui/LoadingIndicator.tsx`**

Port the HTML structure from `public/loader_Truck.html`'s `<body>` verbatim (the `<div class="dn-truckloader">` through its closing tag), converting HTML attribute syntax to JSX (`class` → `className`) and pointing the four `<img>` tags at the three extracted files in `public/loader/` (both puff elements point at the same `puff.png`). Import the CSS module as a plain side-effect import (Next.js supports importing a `.css` file directly into a component for component-scoped styles when the class names are already unique, same mechanism `app/globals.css` uses at the app level, just imported here at the component level instead — this satisfies "scope hem strikt aan de component" since the CSS file is only ever imported by this one component file and nowhere else).

Add a `prefers-reduced-motion` check via `matchMedia` so the component can expose an accessible status even in the reduced-motion case — though note the ported CSS's own `@media (prefers-reduced-motion: reduce)` block (already present, preserved verbatim in Step 2) already disables all the keyframe animations and repositions the rig statically at 50% via pure CSS, with no JavaScript required for that part. The component only needs JavaScript to decide whether to render `.dn-tl-puff-drift` at all when reduced motion is preferred — the source CSS already does `display: none` on it in that case (`.dn-tl-puff-drift { display: none; }` inside the reduced-motion media query), so no JavaScript branching is actually necessary here either. Given that, `LoadingIndicator.tsx` can be a plain server component with zero client-side logic — correct the "client component" classification from this task's Interfaces line: it does not need `"use client"`, since 100% of its reduced-motion behavior is already handled by the ported CSS's own media query.

```tsx
import "./LoadingIndicator.loader.css";

export function LoadingIndicator({ label = "Laden..." }: { label?: string }) {
  return (
    <div className="dn-truckloader" role="status" aria-label={label}>
      <div className="dn-tl-track">
        <div className="dn-tl-floor" />
        <div className="dn-tl-rig">
          <img className="dn-tl-puff dn-tl-puff-base" src="/loader/puff.png" alt="" />
          <img className="dn-tl-puff dn-tl-puff-drift" src="/loader/puff.png" alt="" />
          <div className="dn-tl-bounce">
            <img className="dn-tl-truck" src="/loader/truck.png" alt="" />
            <img className="dn-tl-cargo" src="/loader/cargo.png" alt="" />
            <span className="dn-tl-hub dn-tl-hub-f" />
            <span className="dn-tl-hub dn-tl-hub-r" />
          </div>
        </div>
      </div>
    </div>
  );
}
```

The `label` prop defaults to a literal Dutch string rather than pulling from the dictionary system — this is a deliberate, narrow exception: `LoadingIndicator` is not yet wired into any locale-aware page (per this task's own "niet koppelen aan paginaovergangen" instruction), so it has no `locale` prop to resolve a dictionary from. A future phase that wires this into an actual page passes a translated `label` prop from that page's own dictionary at that time — the default merely ensures the component renders sensibly if used without a prop today, and is not a second source of translated copy (it is the single default value of a single prop, not a duplicate dictionary).

- [ ] **Step 4: Delete `public/loader_Truck.html`**

- [ ] **Step 5: Verify types and confirm no CSS leakage**

Run: `npx tsc --noEmit`
Expected: no errors (Next.js's built-in CSS-module-adjacent handling accepts a plain `.css` side-effect import in a component file without a type declaration needed — confirm this compiles; if TypeScript complains about the CSS import specifically, that is new information requiring a fix in this step, not a plan defect to route around).

Run: `grep -r "dn-tl-\|dn-truckloader" --include="*.tsx" --include="*.css" .` and confirm the only matches are inside `components/ui/LoadingIndicator.tsx` and `components/ui/LoadingIndicator.loader.css` — proving the class names are scoped to exactly these two files as required.

- [ ] **Step 6: Commit**

```bash
git add components/ui/LoadingIndicator.tsx components/ui/LoadingIndicator.loader.css public/loader/truck.png public/loader/cargo.png public/loader/puff.png
git rm public/loader_Truck.html
git commit -m "feat: port LoadingIndicator verbatim from standalone truck-loader demo"
```

---

## Task 17: Documentation — `docs/ARCHITECTURE.md` and `docs/STRUCTURE.md`

**Files:**
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/STRUCTURE.md`

**Interfaces:** none.

- [ ] **Step 1: Add the design-system section to `docs/ARCHITECTURE.md`**

Append after the existing "Product grid convention" section (Task 7) and "Icon convention" section (Task 3):

```markdown
## Design system: tokens, components, and motion

All spacing, radius, shadow, text-size, and motion tokens added in this
phase live in the single `@theme` block in `app/globals.css`, alongside
the color and font tokens already established. Two named hover durations
exist site-wide — `--duration-hover` (320ms, used for card lift/border
transitions) and `--duration-hover-fast` (240ms, used for text/icon color
and small positional shifts like the mega-menu chevron) — matching the two
distinct speeds specified by the design reference this phase was built
from, rather than collapsing them into one blended value.

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
```

- [ ] **Step 2: Add all new files and locations to `docs/STRUCTURE.md`**

Add new bullets to the "Placement rules" section, and update the existing `public/brand/` bullet's neighbor context (do not alter the `public/brand/` bullet itself — it remains exactly three files, unaffected by this phase):

```markdown
- `public/loader/` holds exactly three files: `truck.png`, `cargo.png`,
  and `puff.png`, referenced only by `components/ui/LoadingIndicator.tsx`.
  No other component reads from this directory.
- `components/ui/LoadingIndicator.loader.css` is the one styling file in
  the project that does not consume tokens from the `@theme` block — it
  is a verbatim port of a pre-built animation and is imported only by
  `components/ui/LoadingIndicator.tsx`. Every other CSS or component file
  in the project uses tokens exclusively.
- `components/ui/Button.tsx`, `Card.tsx`, `FavoriteButton.tsx`, `Tabs.tsx`,
  `USPBar.tsx`, and `LoadingIndicator.tsx` are framework-level UI
  primitives with no domain knowledge, alongside the existing `Container`
  and `Logo`.
- `components/layout/MegaMenu.tsx` and `MobileNav.tsx` are page-shell
  navigation components, alongside the existing `Header`, `Footer`,
  `LocaleSwitcher`, and `SiteShell`.
```

- [ ] **Step 3: Commit**

```bash
git add docs/ARCHITECTURE.md docs/STRUCTURE.md
git commit -m "docs: record Phase 9 design system, loader exception and known gaps"
```

---

## Task 18: Full verification

**Files:** none — verification only, except fixing whatever this step finds broken.

**Interfaces:** none.

- [ ] **Step 1: Type-check**

Run: `npx tsc --noEmit`
Expected: zero errors. Fix without casts or suppressions if anything surfaces.

- [ ] **Step 2: Build and confirm every new token utility actually generates CSS**

Run: `npm run build`
Expected: build succeeds. Every token namespace used in this plan was empirically verified against the installed Tailwind v4.3.3 engine before this plan was finalized (`--radius-*`, `--shadow-*`, `--text-*`, `--spacing-*`, `--ease-*`, `--color-*` all map directly; `--transition-duration-*` is the one namespace requiring a different `@theme` property name than its generated class name — see Task 1's note). As a final confirmation, inspect the built CSS (`.next/static/css/*.css` after build) and grep for `.duration-hover`, `.rounded-card`, `.shadow-button`, `.text-heading-sm`, `.gap-gap-md`, `.ease-hover` to confirm each rule exists with a non-empty declaration — do not just trust that `next build` exiting 0 means every class rendered, since an unrecognized custom class name is silently dropped by Tailwind rather than causing a build error.

- [ ] **Step 3: Start the app and audit routes**

Start `npm run start` (after `npm run build`) or `npm run dev`, and for each of the same 9 top-level routes verified in Phase 8b (home, cart, account, categories list, category detail, product detail, content page, articles list, article detail), confirm via the same method used in Phase 8b (`curl` + `grep` for the unique `<header ...>` / `<footer ...>` class strings — note these class strings changed in this phase's Header/Footer rebuild, so update the grep patterns to match the new `sticky top-0 z-50 border-b border-border bg-background/95` header class and the new `bg-contrast text-background` footer class, which is unchanged from Phase 8b) that Header and Footer each render exactly once per route.

- [ ] **Step 4: Keyboard-test the mega-menu and mobile panel**

Since this cannot be fully automated via `curl` (keyboard interaction requires a real or scripted browser), use the Playwright CLI (already available in this environment) to open the homepage, tab to the mega-menu trigger, confirm it opens on focus, press `Escape`, confirm it closes and focus returns to the trigger. Separately, resize the viewport to a mobile width, open the mobile nav trigger, confirm focus moves into the panel, `Tab` through to the last focusable element, confirm one more `Tab` wraps back to the first (not escaping the panel), press `Escape`, confirm the panel closes and focus returns to the trigger. Report the outcome of each specific check, not just "it works."

- [ ] **Step 5: Contrast check**

Using the token hex values (`--color-accent: #E0B200` background with `--color-contrast`/`--color-text` foreground text; `--color-contrast: #141414` background with `--color-background: #F6F3EE` foreground text), compute the WCAG contrast ratio for each pairing actually used in this phase's components (accent-background buttons with contrast/text-colored labels; contrast-band footer with background-colored text) and report whether each meets 4.5:1 (body text) or 3:1 (large text/UI components). If any pairing fails, report it explicitly per this task's own "meld het als iets niet voldoet" instruction — do not silently adjust colors, since color values are locked to the existing five-token brand palette from Phase 8 and any color change is a decision for the human, not a default action here.

- [ ] **Step 6: Report and commit any fixes found**

If Steps 1-5 required code fixes, commit them separately:

```bash
git add -A
git commit -m "fix: resolve issues found during Phase 9 verification"
```

(Only run this if fixes were actually needed — no empty commit.)

---

## Self-Review Notes

- **Spec coverage:** All 28 original numbered points plus the loader addendum map to a task. Points 21-22 (grid convention, responsive audit) map to Task 7 and Task 18 respectively. Points 23-24 (focus visibility, contrast) map to the existing global `:focus-visible` rule (already present pre-phase, confirmed still active) plus Task 18 Step 5's explicit contrast computation.
- **Placeholder scan:** No TBD/TODO. Every deferred item (subcategories, shipping USP, sticky-scroll-on-scroll-only, empty featured block) is explicitly named as deferred with a stated reason, not silently stubbed.
- **Type consistency:** `MainCategoryDto`'s new `description` field (Task 11) is used identically in `MegaMenu` (Task 11) and unaffected in `Header`/`Footer`'s existing `.map()` calls (Tasks 13/15, which only read `.id`/`.slug`/`.name`, unaffected by the new field's presence). `Logo`'s new `size` prop (Task 13) defaults to `"sm"`, leaving `Footer`'s existing call (Task 15, which does not pass `size`) unchanged in behavior.
- **Known internal correction:** Task 2's own header says "via app/[locale]/layout.tsx" but the step content correctly redirects base heading styles to `app/globals.css` instead, since JSX-level per-component overrides are what the original task text rules out — this is flagged inline in the task itself, not left as a silent contradiction.
