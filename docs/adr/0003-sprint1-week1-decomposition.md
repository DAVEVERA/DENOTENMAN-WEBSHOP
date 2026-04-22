# 0003. Sprint 1 week 1 decomposition

Date: 2026-04-21
Status: accepted

## Context

The monorepo scaffold, Prisma schema, seed data, and infrastructure (docker-compose, turbo, pnpm) are in place. No application code exists yet. Sprint 1 week 1 must deliver the shared packages, API skeleton, storefront skeleton, and CI pipeline so that subsequent sprints can build features on a working vertical slice.

## Decision

Decompose into 7 tasks across 5 agents. Shared packages (schemas, utils, ui) are built first in parallel. API and storefront follow sequentially since they consume the packages. CI runs last since it must validate all apps. The critical path is: T1 (schemas) then T5 (api) then T6 (storefront). See the full task plan maintained by the orchestrator.

## Consequences

- Parallel work on T1/T2/T3/T4 maximises throughput across agents.
- API and storefront depend on schemas; no work can start there until T1 is done.
- Storefront depends on both API (T5) and UI (T4), making it the last app task.
- CI (T7) validates the full build, so it is the final task.
- Risk: if T1 (schemas) slips, the entire critical path shifts. Mitigation: T1 is sized S.

## Alternatives considered

- **Build everything sequentially**: rejected. Wastes agent parallelism.
- **Start API without shared schemas**: rejected. Would create contract drift immediately.
- **Include admin app in week 1**: rejected. Scope creep; storefront-first gives a demoable vertical slice.
