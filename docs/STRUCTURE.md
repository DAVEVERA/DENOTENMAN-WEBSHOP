# Structure Contract

This document defines where every kind of file belongs. Do not deviate.

## Placement rules
- Route segments live only under `app/[locale]/`. Every user-facing page is a `page.tsx`.
- `sitemap.ts` and `robots.ts` live at the `app/` root (not inside `[locale]`).
- `middleware.ts` lives at the project root.
- All shared, framework-agnostic logic lives in `lib/`. No React components here.
- All React components live in `components/`, grouped by domain
  (`ui`, `layout`, `product`, `category`).
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

## Hard constraints
- Code files (.ts, .tsx, .prisma, .json) contain code/data only. No prose,
  no comments that explain intent at length, no instructions, no signatures.
- Documentation files (.md) contain prose only. No executable logic.
- No file may be authored with or reference any tool, generator or author name.
- Do not create folders outside this contract. If a new concern arises,
  extend an existing folder or propose an addition in `docs/` first.