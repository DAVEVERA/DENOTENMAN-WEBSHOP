# ADR 0008 — Stripe webhook idempotency

- **Status**: Accepted
- **Date**: 2026-05-12
- **Decision-makers**: @architect, @auditor, @backend-dev
- **Context vote**: consensus-vote sprint 2 — top action #2

## Context

Stripe retries webhook deliveries on any non-2xx response and on network timeouts. A naive handler that processes `checkout.session.completed` twice will create two orders, send two confirmation emails, and double-decrement stock. The handler must therefore be exactly-once with respect to side effects, even though the network is at-least-once.

Sprint 2 ships the API only — the BullMQ worker arrives in sprint 3. So today the side effect (order creation, email enqueue, stock decrement) runs inline within the webhook request. Stripe enforces a 5-second response budget; exceeding it triggers a retry that we then have to dedupe.

Alternatives considered: (a) in-memory event-id cache — rejected, evicts on restart and never works under multiple replicas; (b) Redis SETNX — rejected, splits the consistency boundary across two stores; (c) full outbox pattern with a worker — rejected for sprint 2 (no worker yet), planned for sprint 3.

## Decision

Introduce a Prisma table `StripeEvent { id String @id, type String, processedAt DateTime @default(now()), payload Json }`. The webhook handler runs this flow, in order:

1. Verify signature with `stripe.webhooks.constructEvent(rawBody, signatureHeader, endpointSecret)`. On failure: respond `400`.
2. Open a `prisma.$transaction`.
3. Attempt `prisma.stripeEvent.create({ data: { id: event.id, type: event.type, payload: event } })`. If it throws on the unique constraint of `id`: commit (no-op), respond `200` immediately. This is the idempotency check.
4. Otherwise execute the side effect for `event.type` inside the same transaction. Commit. Respond `200`.

No background job sits between insert and effect; the outbox pattern is deferred until the worker exists in sprint 3.

## Consequences

- **Positive**:
  - Exactly-once side effects under arbitrary Stripe retry behaviour.
  - Replayable: `StripeEvent.payload` retains the full event for audit and re-processing.
  - Single-store consistency — Postgres is the source of truth for both dedup and side effect.
- **Negative**:
  - Side effect runs inside a synchronous webhook request, so any slow downstream (email, ERP) eats into the 5-second Stripe budget.
  - Long-running effects must be moved to the worker in sprint 3; until then, the handler can only do fast DB writes.
- **Trade-offs accepted**:
  - Coupling effect latency to webhook latency, in exchange for not building an outbox before we have a worker to drain it.

## Implementation notes

- Raw body is mandatory for signature verification. Configure Fastify with a route-scoped raw body parser: `addContentTypeParser('application/json', { parseAs: 'buffer' }, ...)` only when the request URL begins with `/v1/stripe/webhook`. All other routes use the standard JSON parser.
- The handler returns `200` within 5s on every valid-signature event, including duplicates. Only invalid signatures return `400`. Never return `5xx` for application errors — log them and respond `200` after persisting the event for replay.
- For event types that will eventually move to the worker, leave a single inline marker comment: `// TODO(worker): enqueue` at the call site. Synchronous execution today.
- Tests required: (a) valid signature → `200` and one side effect; (b) tampered signature → `400` and zero side effects; (c) replay of identical `event.id` → `200`, exactly one row in `Order`, exactly one row in `StripeEvent`.
- The endpoint secret comes from `STRIPE_WEBHOOK_SECRET` validated by `EnvService` (ADR 0010).

## References

- Consensus vote architect/auditor/@backend-dev — sprint 2, top action #2
- Stripe docs — Best practices for using webhooks (event signing, idempotency)
- Stripe docs — Webhook delivery attempts and retries
