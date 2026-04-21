# DeNotenman — Build Prompt (Claude Code / Antigravity)

Author: **MNRV**. This is the only name that appears in code, commits, READMEs, package.json, LICENSE, or any metadata. No references to AI assistants, Claude, Anthropic, Google, Antigravity, or any generation tooling. Dutch UI copy, English identifiers.

> Prerequisite: the bootstrap bundle (`CLAUDE.md`, `.claude/agents/`, `.claude/skills/`) must already be in place. Verify with `/agents` → seven agents, `/skills` → seven skills.

---

## 0. Team & protocol (recap)

Orchestrator delegates; does not write application code. Roster:

- `@architect` — plans, ADRs, arbitrates.
- `@frontend-dev` — `apps/storefront`, `apps/admin`, `packages/ui`.
- `@backend-dev` — `apps/api`, `apps/worker`.
- `@fullstack-dev` — `packages/schemas`, `packages/utils`, API client.
- `@database-dev` — `prisma/`.
- `@app-admin` — CI, Docker, Vercel, Fly, envs, monitoring.
- `@auditor` — merge gate.

Consensus vote (architect + auditor + relevant specialist, all must approve) required for: schema changes, new runtime deps, auth/payment/webhook changes, architectural shifts, production deploys.

Skills invoked by name: `no-attribution`, `commit-hygiene`, `dutch-copy`, `prisma-migration`, `importer-pipeline`, `test-discipline`, `consensus-vote`.

## 1. Mission

Production-ready, mobile-first webshop for DeNotenman (noten, zuidvruchten, pitten & zaden, honing, snacks) plus an owner-facing product importer. Monorepo, typed end-to-end, deployable on day one.

## 2. Stack (pinned)

- **Frontend**: Next.js 14 App Router, React 18, TypeScript 5, Tailwind CSS, shadcn/ui (only used components copied in).
- **Backend**: NestJS 10, Fastify adapter.
- **DB**: PostgreSQL 16 + Prisma 5.
- **Auth**: JWT access + refresh (httpOnly, SameSite=strict), argon2.
- **Payments**: Stripe Checkout Session, webhook-verified.
- **Storage**: Cloudflare R2 for product images.
- **Queue**: BullMQ on Upstash Redis.
- **Validation**: Zod in `packages/schemas`, shared across apps.
- **Testing**: Vitest, Supertest, Playwright.
- **CI**: GitHub Actions.
- **Hosting**: Vercel (storefront + admin), Fly.io (api + worker), Neon (Postgres).
- **Package manager**: pnpm. **Build orchestration**: Turborepo.

## 3. Repo layout

```
denotenman/
  apps/
    storefront/          Next.js 14, App Router, domain denotenman.nl
    admin/               Next.js 14, domain admin.denotenman.nl
    api/                 NestJS on Fastify
    worker/              BullMQ consumer
  packages/
    ui/                  shared primitives
    schemas/             Zod + inferred types
    api-client/          typed fetch wrapper (generated from schemas)
    utils/               pure helpers
    config/              eslint, tsconfig, tailwind presets
  prisma/
    schema.prisma
    migrations/
    seed.ts
  e2e/                   Playwright specs
  docs/
    adr/                 NNNN-<slug>.md
    votes/               YYYY-MM-DD-<slug>.md
    runbooks/
    architecture.md
  .github/workflows/
  docker-compose.yml     postgres + redis + maildev
  turbo.json
  pnpm-workspace.yaml
  Dockerfile             multi-stage, builds api+worker
  fly.toml               two processes
  vercel.json
  README.md              (see Section 16)
```

## 4. Data model (Prisma)

Models: `Product`, `ProductVariant`, `ProductImage`, `Category` (self-referential), `Tag`, `Inventory`, `Order`, `OrderLine`, `Cart`, `CartLine`, `Customer`, `Address`, `User` (role: owner/admin/staff), `ImportBatch`, `ImportRow`, `AuditLog`, `ShippingRule`.

Rules (see `prisma-migration` skill for workflow):
- `Product.slug` unique; auto from name, manually overrideable.
- Single-variant products still have one `ProductVariant` row.
- Prices in cents (`Int`), currency `EUR` fixed v1.
- Soft delete via `deletedAt` on Product, ProductVariant, Category; enforced via Prisma extension.
- `AuditLog` written on every admin/importer mutation (who, what, before, after).
- Timestamps UTC, `@db.Timestamptz(6)`.
- FK-indexed + indexes on every `where`/`orderBy` column.
- Full-text: `tsvector` generated column on Product (name + description + tags), GIN index.

## 5. Catalog taxonomy (seed data, exact Dutch labels)

- **Noten**: Amandelen, Cashewnoten, Walnoten, Hazelnoten, Pecannoten, Pistaches, Macadamianoten, Paranoten, Gemengde noten, Pinda's.
- **Gedroogd Fruit / Zuidvruchten**: Dadels, Abrikozen, Vijgen, Cranberry's, Gojibessen, Moerbeien, Zuurbessen, Rozijnen, Gember, Bananen, Ananas.
- **Pitten & Zaden**: Chiazaad, Lijnzaad, Pompoenpitten, Zonnebloempitten, Pijnboompitten, Sesamzaad, Quinoa, Salademix.
- **Natuurvoeding**: Honing, Superfoods.
- **Snacks**: Pindarotsjes, Crackers/Zoutjes, Gevriesdroogde vruchten met chocolade, Bananenchips.
- **Bakproducten**.
- **Healthy Disks**: Dadel-Kokos, Pruim-Cranberry, Notenmix-varianten.

Standard variant weights: 200 g, 250 g, 500 g, 750 g, 1000 g. Product card shows price + derived `€ x,xx per 100 g`.

## 6. Storefront — pages & behavior

```
app/
  (shop)/
    page.tsx                         home
    categorie/[slug]/page.tsx        category, filters, paging
    product/[slug]/page.tsx          PDP
    zoeken/page.tsx                  search results
    winkelwagen/page.tsx
    checkout/page.tsx
    bedankt/[orderId]/page.tsx
  account/
    login/page.tsx
    bestellingen/page.tsx
    adressen/page.tsx
  (content)/
    over-ons/page.tsx
    verzending/page.tsx
    algemene-voorwaarden/page.tsx
    privacy/page.tsx
  api/                               BFF proxy only
```

- SSR for category + PDP; ISR with on-demand revalidation on product update.
- Sitemap + robots auto-generated. JSON-LD `Product` + `BreadcrumbList` on PDP.
- Search: Postgres full-text, no external search service v1.
- Cart: anonymous via signed cookie, merged on login.
- Checkout: guest allowed. Stripe Checkout Session. Webhook creates `Order`, decrements stock in a transaction.
- Shipping rules loaded from `ShippingRule` table. Defaults: NL free ≥ €40, BE free ≥ €50.

## 7. Importer — owner-facing product database UI

Separate admin app. Spreadsheet-feel bound to the real schema. Implementation must follow the `importer-pipeline` skill exactly.

Summary:
- Bulk CSV/XLSX/JSON with field mapping wizard, saved templates.
- Dry-run validation with downloadable error CSV.
- Dedup strategy selectable (by SKU | by slug | by name+variant). Conflict: skip / overwrite / create-new.
- Single product form uses same Zod schema as importer.
- Bulk edit grid: filter → multi-select → apply patch (price %, stock, status, category) with diff preview.
- Import history with 24h undo via `AuditLog` snapshots.
- Long jobs run in `apps/worker`, UI polls status, WebSocket/SSE progress.
- Keyboard-first grid (arrows, Enter, Esc, Cmd+S). Destructive confirms require typing expected count or product name.

## 8. API surface (versioned `/v1`)

Public:
- `GET /v1/products`, `GET /v1/products/:slug`, `GET /v1/categories`
- `POST /v1/cart`, `PATCH /v1/cart/:id`, `DELETE /v1/cart/:id/lines/:lineId`
- `POST /v1/checkout/session`
- `POST /v1/webhooks/stripe` (raw body, signature-verified, idempotent)

Authenticated (customer):
- `GET /v1/me`, `GET /v1/me/orders`, `GET /v1/me/orders/:id`, `PATCH /v1/me/addresses`

Admin (`role: owner|admin|staff`):
- CRUD products, variants, images, categories, tags, shipping rules.
- `POST /v1/admin/imports`, `GET /v1/admin/imports/:id`, `GET /v1/admin/imports/:id/errors`, `POST /v1/admin/imports/:id/commit`, `POST /v1/admin/imports/:id/undo`.
- `POST /v1/admin/products/bulk` — patch set.
- `GET /v1/admin/audit`.

OpenAPI generated via NestJS Swagger, served at `/docs` (admin-only in production).

## 9. Brand & UI

Tailwind tokens:

```
walnut:   #5A3E2B   primary
almond:   #8B5E3C   accent
oat:      #F4EFE6   surface
charcoal: #1E1E1E   text
sage:     #6F8F6A   success/responsible
```

Typography: Inter or Geist for UI; optional Fraunces for hero headings, sparingly.

Primitives in `packages/ui`: Button, Input, Select, Textarea, Checkbox, RadioGroup, Badge, Card, Dialog, Drawer, Toast, Table, Pagination, Price, VariantPicker, QuantityStepper, Breadcrumbs, Tabs, EmptyState.

Product card order: image (1:1, `next/image`) → name → variant/weight → price + per 100 g → smaak/structuur one-liner → trust badge row max 3 (Vers verpakt / Transparante herkomst / Zonder onnodige toevoegingen).

All copy per `dutch-copy` skill. Kort, feitelijk, direct, geen hype.

## 10. Non-functional

- **Performance**: LCP ≤ 1.8s mobile on 4G throttled. Lighthouse: Perf ≥ 90, A11y ≥ 95, BP ≥ 95, SEO ≥ 95. AVIF via `next/image`. Minimum client JS on category pages.
- **Accessibility**: WCAG 2.2 AA. Focus visible, keyboard-complete, contrast ≥ 4.5:1, `aria-live` on cart changes.
- **Security**: Helmet, strict CSP, CSRF on admin mutations, `@nestjs/throttler` (public 100/min, auth 30/min). Secrets via env. Auditor enforces OWASP checklist.
- **Observability**: pino structured logs, request id middleware, Sentry for all apps, `/healthz` + `/readyz`.
- **GDPR**: granular cookie consent, data export + delete endpoints, AuditLog 2-year retention.

## 11. Testing & CI

Per `test-discipline` skill.

CI (`@app-admin`):
1. setup (pnpm cache) 2. lint 3. typecheck 4. test-unit 5. test-integration (Postgres service) 6. test-e2e (Playwright + Postgres + Redis services) 7. build 8. preview deploy on PR 9. prod deploy on tag with manual approval.

Four critical E2E flows always present:
1. Browse → PDP → add to cart → guest checkout → success.
2. Admin login → create product → upload image → publish → visible on storefront.
3. Importer upload CSV → map → validate → commit → products exist → undo → products gone.
4. Stripe webhook: `payment_intent.succeeded` → order created → stock decremented.

## 12. Deployment

- Storefront → Vercel `denotenman-storefront` → `denotenman.nl`.
- Admin → Vercel `denotenman-admin` → `admin.denotenman.nl`, auth middleware at edge.
- API + Worker → Fly.io `denotenman-api`, two processes, region `ams`, autoscale.
- Postgres → Neon, `eu-central-1`, branches per preview.
- Redis → Upstash, Frankfurt.
- Storage → Cloudflare R2, bucket `denotenman-media`.
- Migrations: `prisma migrate deploy` as release step, never auto on boot.
- Backups: Neon PITR 30d + weekly `pg_dump` to R2, encrypted with `age`, 90d retention. Monthly restore test documented in `docs/runbooks/restore.md`.

## 13. Sprint plan (4 weeks)

**Week 1 — foundation**
Monorepo + CI + Prisma schema (consensus vote) + seed + API skeleton (products, categories) + storefront home/category/PDP reading real data + design tokens + base UI primitives.

**Week 2 — storefront commerce**
Cart, checkout, Stripe, webhook, order creation, customer accounts, order history, search, filters, sitemap, JSON-LD, SEO pass, Lighthouse budget met.

**Week 3 — admin + importer**
Admin shell, auth, product CRUD, image upload to R2, variants editor, category manager, bulk edit grid, importer wizard, BullMQ worker, import history, undo, audit log.

**Week 4 — harden & ship**
E2E suite green, a11y fixes, security headers + rate limits, Sentry wired, cookie banner, content pages, shipping rule editor, staging → production cutover, runbooks in `docs/runbooks/`.

## 14. Definition of done (per feature)

Auditor gate checklist — all must pass:

1. Types compile, zero `any`.
2. `no-attribution` scan clean.
3. Tests per `test-discipline` matrix, coverage ≥ 80% on changed files.
4. Lint and format clean.
5. Keyboard + screen reader sanity, contrast ≥ 4.5:1.
6. Dutch copy, no English leaking.
7. No console errors, no hydration warnings.
8. Section it belongs to updated in README.

## 15. House rules (reminders)

- No AI/tool attribution anywhere, including commit messages.
- `package.json` author: `MNRV`. License: proprietary, © MNRV.
- Dutch in UI. English in identifiers, code, tests, logs.
- No `any`, no `@ts-ignore`, no silent `eslint-disable`.
- Comments only when logic is non-obvious.
- Conventional Commits, no trailers.

## 16. README skeleton

Sections, in order: Overview — Requirements — Install — Environment — Development — Database — Testing — Deployment — Architecture — License. License: proprietary, © MNRV. No contributors section. No acknowledgements.

---

## Kick-off command

Paste this after the bootstrap and after this prompt:

```
@architect: decompose sprint 1 into owner-assigned sub-tasks.
Delegate in parallel:
  - @app-admin: monorepo scaffold (pnpm workspace, Turborepo, docker-compose, .env.example)
  - @database-dev: Prisma schema from Section 4 + seed from Section 5
  - @fullstack-dev: packages/schemas skeleton (Product, Category, Cart)

Trigger consensus-vote on the Prisma schema before first commit.
@auditor reviews every commit via the merge gate.
No application code from the orchestrator — delegate everything.
```
