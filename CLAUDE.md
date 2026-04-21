# DeNotenman — Project Directive

Author: **MNRV**. No AI attribution anywhere — see `no-attribution` skill. Dutch UI, English code.

## Team (sub-agents)

The main Claude Code session is the **orchestrator**. It does not write application code directly — it delegates. Sub-agents live in `.claude/agents/`:

| Agent              | Owns                                                | Files                                     |
|--------------------|-----------------------------------------------------|-------------------------------------------|
| `@architect`       | Plans, ADRs, arbitrates disputes, system coherence  | `docs/adr/`, `docs/architecture.md`       |
| `@frontend-dev`    | Next.js storefront + admin UI, a11y                 | `apps/storefront/`, `apps/admin/`, `packages/ui/` |
| `@backend-dev`     | NestJS API, auth, webhooks, rate limiting           | `apps/api/`, `apps/worker/`               |
| `@fullstack-dev`   | Shared schemas, API client, contract parity         | `packages/schemas/`, `packages/utils/`    |
| `@database-dev`    | Prisma, migrations, indexes, query perf             | `prisma/`                                 |
| `@app-admin`       | CI/CD, Docker, Vercel/Fly, envs, monitoring         | `.github/workflows/`, `Dockerfile`, `fly.toml` |
| `@auditor`         | Security, code quality, a11y, attribution scan      | Reviews everything before merge           |

## Consensus protocol

Before executing any of the following, the orchestrator requires **consensus from 3 agents** (architect + auditor + relevant specialist):

1. Prisma schema change.
2. Adding a new runtime dependency.
3. Any change touching auth, payments, or webhooks.
4. Architectural shift from the build prompt.
5. Production deploy.

Voting runs agents in parallel. All three must approve. Disagreement → architect writes an ADR in `docs/adr/NNNN-<slug>.md` that records the decision and reasoning. See `consensus-vote` skill.

## Merge gate

No feature merges until `@auditor` approves. Auditor checklist:

1. `no-attribution` scan clean (no Claude/Anthropic/AI strings, no Co-Authored-By).
2. TypeScript strict, zero `any`.
3. Tests present per `test-discipline` skill; coverage ≥ 80% on changed files.
4. Keyboard-navigable, contrast ≥ 4.5:1, focus visible.
5. Input validated on API (Zod), authz on every admin route.
6. No console errors, no hydration warnings.

## Skills (invoke by name)

- `no-attribution` — before every commit and before publishing any file.
- `commit-hygiene` — every commit.
- `dutch-copy` — any UI string.
- `prisma-migration` — any schema change.
- `importer-pipeline` — importer work.
- `test-discipline` — DoD gate.
- `consensus-vote` — architectural decisions.

## Workflow per task

1. Orchestrator reads task. Invokes `@architect` to decompose into sub-tasks with owner + acceptance.
2. Orchestrator delegates each sub-task to its owner agent in parallel where possible.
3. `@fullstack-dev` reconciles contracts between frontend and backend.
4. Orchestrator triggers `consensus-vote` skill for gated changes.
5. `@auditor` reviews before merge.
6. `@app-admin` ships to preview → production.

## House rules

- No file, comment, commit, or README mentions AI, Claude, Anthropic, or generation tooling.
- `package.json` author: `MNRV`. License: proprietary, © MNRV.
- Dutch in UI. English in identifiers, code, tests, logs.
- No `any`. No `// @ts-ignore`. No `eslint-disable` without inline justification approved by auditor.
- Comments only where logic is non-obvious.
- Conventional Commits, no trailers, no body unless necessary.
