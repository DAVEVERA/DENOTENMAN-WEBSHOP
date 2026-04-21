---
name: test-discipline
description: Use before marking any feature done. Defines minimum test coverage per feature type — unit, integration, E2E. No feature merges without the test matrix for its type satisfied.
---

## Test matrix by feature type

| Feature type              | Vitest unit | Supertest integration | Playwright E2E | Coverage target |
|---------------------------|-------------|-----------------------|----------------|-----------------|
| Pure util / helper        | required    | —                     | —              | 100%            |
| Zod schema                | required    | —                     | —              | 100%            |
| UI primitive (packages/ui)| required    | —                     | —              | ≥ 90%           |
| Storefront page (visible) | render test | —                     | required       | ≥ 80%           |
| Admin page                | render test | —                     | required       | ≥ 80%           |
| API endpoint              | service     | required              | —              | ≥ 80%           |
| Worker job                | required    | required (Redis svc)  | —              | ≥ 80%           |
| Migration                 | —           | seed-then-migrate     | —              | —               |

## Rules

- **No `.only`, `.skip`, `xit`, `xdescribe`.** CI fails on detection.
- **No snapshot-only tests.** If you snapshot, also assert on specific fields.
- **Real DB in integration tests.** Use Docker Compose Postgres or a Neon branch — not SQLite, not mocks.
- **Mocks minimal.** Only mock: network calls to third parties (Stripe, mail), time (`vi.useFakeTimers()`), random.
- **Test names state the behavior.** `"rejects checkout when cart is empty"`, not `"test 1"`.
- **Arrange-act-assert** structure. Empty lines between sections.

## File placement

- Unit tests: `<file>.test.ts` next to the source.
- Integration: `apps/api/test/<feature>.e2e-spec.ts` (Nest convention).
- E2E: `e2e/<flow>.spec.ts` at repo root, runs against built apps.

## Coverage command

```bash
pnpm test -- --coverage
```

CI fails if coverage on changed files (via `diff-cover` or equivalent) falls below the target for the feature type.

## Critical E2E flows (must always pass)

1. **Browse → PDP → add to cart → guest checkout → success** (storefront).
2. **Login → create product → upload image → publish → appears on storefront** (admin + storefront).
3. **Upload CSV → map → validate → commit → products exist → undo → products gone** (admin).
4. **Stripe webhook: payment_intent.succeeded → order created → stock decremented** (API, integration level).

## What the auditor checks

- Coverage report meets target.
- No disabled tests.
- E2E present for user-facing work.
- Integration test hits real DB (grep for `SQLite`, `mockDeep`, `PrismockClient` in API test folder → finding).
