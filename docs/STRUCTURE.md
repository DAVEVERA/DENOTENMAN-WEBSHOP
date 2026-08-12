# Structure Contract

This document defines where every kind of file belongs. Do not deviate.

## Placement rules
- Route segments live only under `app/[locale]/`. Every user-facing page is a `page.tsx`.
- `sitemap.ts` and `robots.ts` live at the `app/` root (not inside `[locale]`).
- `proxy.ts` lives at the project root.
- All shared, framework-agnostic logic lives in `lib/`. No React components here.
- All React components live in `components/`, grouped by domain
  (`ui`, `layout`, `product`, `category`).
- `components/ui/` holds framework-level primitives (`Container`, `Logo`)
  with no domain knowledge. `components/layout/` holds page-shell
  components (`Header`, `Footer`, `LocaleSwitcher`). `components/product/`
  holds product-domain components (`ProductCard`, `ProductGallery`,
  `VariantSelector`, `ProductBrowser`, `FeaturedBanner`). `components/category/`
  is reserved for category-domain components, not yet populated.
- Every route under `app/[locale]/` that is a standalone segment (not a
  list page with its own nested detail route) has its own `layout.tsx`
  rendering `SiteShell` from `components/layout/`, computed from that
  route's own params. Three routes render `SiteShell` directly in their
  own page component instead of via a `layout.tsx`: the home route
  (`app/[locale]/page.tsx`, which shares its directory with the root
  layout and has no route segment of its own to hold a separate layout),
  and the categories and articles list pages (`app/[locale]/categories/page.tsx`,
  `app/[locale]/blogs/articles/page.tsx`), which would otherwise double-wrap
  their nested detail routes (`categories/[category]/`, `blogs/articles/[slug]/`)
  if a shared `layout.tsx` existed at their parent level. `SiteShell` is
  the only place `Header` and `Footer` are composed together; no other
  file renders them.
- `public/brand/` holds `logo-mark.svg`, `logo-wordmark.svg`, and
  `favicon.png`, referenced only by the `Logo` component, plus the
  `icons/` subfolder described below. A fourth file,
  `logo-wordmark-inverted.svg`, is planned: an inverted export of the
  wordmark for placement directly on dark backgrounds. Until it exists,
  the footer shows `logo-wordmark.svg` on a light panel inside the dark
  contrast band. Once `logo-wordmark-inverted.svg` is added, the footer
  switches to rendering it directly on the dark band instead. `Header`
  renders `parts="wordmark"` only — the circular `logo-mark.svg` is not
  shown in the header, only referenced there via unused `alt` text passed
  through the `Logo` API.
  `public/brand/refimageheader.png` is a working design reference, not an
  asset any component reads.
  `logo-wordmark.svg`'s `viewBox` is cropped tight to the artwork's
  measured bounding box (plus a few units of padding), not left at the
  size of the original export canvas — a prior version had a `viewBox`
  more than twice as tall and wide as the visible logotype, which made
  every `Logo` `size` class scale a mostly-empty box and rendered the
  wordmark far smaller than its height class implied. Any future
  replacement of this file must be re-cropped the same way, or the
  same undersized-logo bug returns regardless of what `size` callers
  pass. See "Logo component API" in `docs/ARCHITECTURE.md` for the
  exact numbers.
- `public/brand/icons/` holds `favorite.png`, `shoppingcart.png`, and
  `whatsapp.png` — none currently referenced by any component.
  `components/layout/HeaderActions.tsx` uses `lucide-react` icons
  (`Heart`, `ShoppingCart`, `MessageCircle`) for all three actions instead,
  matching the icon convention below. `favorite.png` additionally carries
  a stock-site watermark and is not usable until replaced with a clean
  export.
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
  `LocaleSwitcher`, and `SiteShell`. `components/layout/HeaderActions.tsx`
  is the client-side icon-button cluster (contact, favorites, cart) `Header`
  renders for its live badge counts. `components/layout/Hero.tsx` is the
  homepage hero slider, rendered only by `app/[locale]/page.tsx`.
- `lib/alternates.ts` is the only source for cross-locale URLs of any kind;
  no other file constructs one.
- `lib/categoryGroups.ts` is the only source for the header's presentation
  grouping of main categories into dropdown nav items; it does not touch
  the database and operates only on `MainCategoryDto[]` already returned
  by `getMainCategories`.
- Colors, fonts, and typographic scales are defined exclusively in the
  single `@theme` block in `app/globals.css`. No component or other CSS
  file defines a color or font token.
- Database schema, migrations and seed live only in `prisma/`.
- Translation JSON lives only in `dictionaries/` (`nl.json`, `en.json`, `fr.json`).
- All prose, plans and explanations live only in `docs/` and `README.md`.
- Config files stay at the root or in `config/`. `next.config.ts` lives at
  the project root (Next.js only reads it from there), not in `config/`.
- `lib/segments.ts` holds the translated route segment for every localized
  section (content pages, products, categories) and is the only source
  for those segment strings.
- `lib/pages.ts` holds the translated slug map for content pages.
- `lib/roles.ts` holds role and permission definitions.
- `modules/` is reserved for future owner-facing modules (cms, rms,
  configurator). Not created yet; this entry only reserves the location.
- `app/[locale]/admin/` is reserved for a future admin portal. Not created
  yet; this entry only reserves the location.
- `docs/CLOUD_SETUP.md` holds the manual Google Cloud provisioning
  checklist (project, Cloud SQL, Storage bucket, service accounts, IAM
  roles, Secret Manager entries).
- `docs/plans/` holds implementation plans for each build phase, one file
  per phase, named `phase-<number>-<short-description>.md` (for example
  `phase-8-ui-foundation.md`). Contains only plan descriptions: no code,
  no configuration, no generated output.

## Hard constraints
- Code files (.ts, .tsx, .prisma, .json) contain code/data only. No prose,
  no comments that explain intent at length, no instructions, no signatures.
- Documentation files (.md) contain prose only. No executable logic.
- No file may be authored with or reference any tool, generator or author name.
- Do not create folders outside this contract. If a new concern arises,
  extend an existing folder or propose an addition in `docs/` first.
- Modules imported by `next.config.ts`, directly or transitively, must use
  only relative imports for their value imports. Next.js transpiles
  `next.config.ts` outside of the tsconfig path aliases, so `@/*` imports
  do not resolve there. Type-only imports (`import type`) are exempt, as
  they are erased before this resolution matters.
- Design source files (`.ai`, `.eps`, `.psd`, `.sketch`, `.fig`, and
  similar editor-native formats) never enter the repository under any
  path. `public/` is served publicly as-is; only the final exported
  assets a component actually references belong there.
