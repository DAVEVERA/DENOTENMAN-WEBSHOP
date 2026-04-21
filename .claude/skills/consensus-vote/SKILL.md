---
name: consensus-vote
description: Use before executing any gated change — schema edits, new runtime dependencies, auth/payments/webhook changes, architectural shifts, production deploys. Orchestrator invokes three agents in parallel (architect, auditor, relevant specialist) and proceeds only if all three approve. Disagreement → architect arbitrates with a written ADR.
---

## When to invoke

Trigger a consensus vote on:

1. Any edit to `prisma/schema.prisma` that adds, removes, or changes a model/field/index.
2. Adding a runtime dependency to any `package.json`. Dev deps (linters, test tools) are exempt.
3. Any change to: authentication, Stripe flow, webhook handling, role checks, rate limiting, CSP.
4. Architectural shift from the build prompt (changing stack, adding a service, splitting a module).
5. First production deploy and any deploy involving a `risky: true` migration.

## Voter panel (always three)

1. **`@architect`** — consistency with build prompt and ADR history.
2. **`@auditor`** — security, quality, attribution risk.
3. **One specialist** — picked based on the change:
   - Schema change → `@database-dev`
   - Dependency → `@app-admin`
   - Auth/payments/webhook → `@backend-dev`
   - UI architectural shift → `@frontend-dev`
   - Contract/schemas/utils → `@fullstack-dev`

## Procedure

1. Orchestrator drafts a proposal:
   ```
   TITLE: <concise>
   TYPE:  <schema|dependency|security|architecture|deploy>
   CHANGE: <what, in 2–4 sentences>
   REASON: <why, in 2–4 sentences>
   RISK: <what could go wrong>
   ROLLBACK: <how we undo>
   ```
2. Orchestrator sends the proposal to the three voters **in parallel**.
3. Each voter returns one of:
   - `APPROVE` (optionally with minor notes).
   - `BLOCK` (must include reason and either required changes or an alternative).
   - `ABSTAIN` (only valid if the change is clearly outside the voter's domain; counts as block for quorum purposes).
4. **All three must APPROVE** for the change to proceed.
5. If any `BLOCK`, architect collects objections and either:
   - Revises the proposal and re-votes (max 2 revisions).
   - Writes an ADR capturing the decision (overriding a block requires explicit owner approval from the user — orchestrator surfaces this).

## Record keeping

Every vote produces an entry in `docs/votes/YYYY-MM-DD-<slug>.md`:

```
# <Title>

Date: YYYY-MM-DD
Type: <type>
Outcome: <approved|blocked|deferred>

## Proposal
<copy of proposal>

## Votes
- architect: APPROVE — <notes>
- auditor: APPROVE — <notes>
- <specialist>: APPROVE — <notes>

## Decision
<one line; link to ADR if one was written>
```

## Rules

- The orchestrator never casts a vote — it only tallies.
- Voters see the same proposal text, no side channels.
- `@auditor` may escalate a BLOCK to the user directly if it involves a security issue.
- A deploy vote is not a substitute for a migration vote — both required when both apply.
