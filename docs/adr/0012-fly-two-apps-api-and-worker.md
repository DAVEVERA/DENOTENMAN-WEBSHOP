# ADR 0012 — Fly.io: two separate apps for api and worker

- **Status**: Accepted
- **Date**: 2026-05-12
- **Decision-makers**: @architect, @auditor, @app-admin
- **Context vote**: consensus-vote sprint 2 — top action #5

## Context

Fly.io supports a multi-process model where a single `fly.toml` defines several `[processes]` running from one image. It is convenient but couples the lifecycles: a worker OOM kill restarts the machine, which interrupts API traffic on the same host; a bad worker deploy forces an API rollback; secrets and scale settings are shared whether or not that makes sense.

The API and worker have very different scaling profiles. The API is HTTP-bound and scales on concurrent connections; the worker is queue-bound and scales on BullMQ depth. They have different resource curves (CPU-light/IO-heavy vs CPU-heavy bursts), different deploy cadences (worker changes more often during importer work), and different security surfaces (API faces the internet; worker pulls from Redis only).

Alternatives considered: (a) one app, two `[processes]` — rejected, lifecycle coupling and shared scaling settings; (b) Kubernetes on a managed control plane — rejected, operational complexity not justified at this stage; (c) run the worker as a Vercel cron — rejected, no long-running task support, no BullMQ semantics.

## Decision

Two Fly apps, each with its own `fly.toml`:

- `apps/api/fly.toml` — app name `denotenman-api`.
- `apps/worker/fly.toml` — app name `denotenman-worker`.

Each app has its own secrets scope, deploy cadence, scale settings, and rollback history. Deploys are explicit per app: `flyctl deploy --config apps/api/fly.toml` and `flyctl deploy --config apps/worker/fly.toml`. CI deploys them as separate jobs; failure in one does not block the other.

## Consequences

- **Positive**:
  - Worker crashes do not affect API availability.
  - Independent scaling: API can sit on a single warm machine while the worker scales to zero.
  - Independent rollback per app — a bad importer worker release does not roll back the storefront API.
  - Secrets surface is minimised: the worker does not get `STRIPE_WEBHOOK_SECRET`; the API does not get worker-only Redis admin credentials.
- **Negative**:
  - Two apps to monitor, two sets of secrets to rotate, two health dashboards.
  - Shared environment values (`DATABASE_URL`, `SENTRY_DSN`) must be set in both apps. Mitigated by a small CI script that fans `flyctl secrets set` to both apps from one source.
- **Trade-offs accepted**:
  - More operational surface area in exchange for clean blast-radius isolation.

## Implementation notes

- Healthchecks:
  - `/healthz` — liveness, every 15s, timeout 5s, restart machine after 2 consecutive failures.
  - `/readyz` — readiness, every 60s, timeout 10s, **logged only**, never used as a restart trigger (avoids restart storms during dependency hiccups).
- Machine policy:
  - `auto_stop_machines = "stop"` on both apps.
  - API: `min_machines_running = 1`, `auto_start_machines = true`.
  - Worker: `min_machines_running = 0`, `auto_start_machines = true` driven by queue events.
- Graceful shutdown: `kill_signal = "SIGTERM"`, `kill_timeout = "30s"`. The worker's BullMQ processors must honour SIGTERM by stopping new job acquisition and finishing in-flight jobs within 30s.
- Secrets via `flyctl secrets set` — never written to `fly.toml`, never committed.
- Image registry: Fly's internal registry for runtime images; GHCR used only as a build cache layer in CI.
- Region: primary `ams` (Amsterdam) for both apps to keep them on the same network as the Neon EU region.
- Each app has its own Sentry `runtime` tag (`api`, `worker`) per ADR 0011.

## References

- Consensus vote architect/auditor/@app-admin — sprint 2, top action #5
- Fly.io docs — Apps and machines, healthchecks, graceful shutdown
- ADR 0001 — tech stack (Fly.io chosen for API and worker)
