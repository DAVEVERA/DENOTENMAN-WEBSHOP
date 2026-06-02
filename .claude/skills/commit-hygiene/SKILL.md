---
name: commit-hygiene
description: Use on every commit. Enforces Conventional Commits, imperative mood, scope where useful, no trailers, no AI attribution, no body unless the "why" is non-obvious.
---

## Format

```
<type>(<scope>): <subject>

[optional body]
```

No footer. No `Co-Authored-By:`. No `Signed-off-by:` unless the project later adopts DCO (it does not).

## Types (closed set)

- `feat` — user-visible feature.
- `fix` — bug fix.
- `refactor` — code change that neither adds features nor fixes bugs.
- `perf` — performance improvement.
- `test` — test-only change.
- `docs` — documentation only.
- `chore` — tooling, deps, config.
- `build` — build system, bundler.
- `ci` — CI pipeline.

## Scope (optional but preferred)

One of: `storefront`, `admin`, `api`, `worker`, `schemas`, `ui`, `utils`, `prisma`, `ci`, `deps`.

## Subject

- Imperative mood: "add", "fix", "remove" — not "added", "fixes", "removes".
- Lowercase first letter.
- No trailing period.
- ≤ 72 characters including type and scope.

## Body

- Only when the "why" is non-obvious from the diff.
- Wrap at 80 columns.
- Bullet list preferred over prose.
- Never restate what the diff already shows.

## Examples

Good:
```
feat(storefront): add per-100g price to product card
fix(api): verify stripe signature before parsing event
refactor(schemas): derive ProductUpdate from ProductCreate via partial
perf(prisma): add GIN index on product search tsvector
chore(deps): pin next to 14.2.18
```

Bad:
```
Updated stuff                  (no type, vague)
feat: Added a new feature.     (past tense, trailing period)
fix(api): Fixed the bug        (capitalized, past tense)
feat(storefront): add per-100g price to product card — co-authored-by: X  (trailer forbidden)
```

## Pre-commit check

The `no-attribution` skill runs against the commit message itself. Any AI/tool reference → abort commit.
