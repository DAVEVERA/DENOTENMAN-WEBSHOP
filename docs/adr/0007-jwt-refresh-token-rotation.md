# ADR 0007 — JWT refresh-token rotation

- **Status**: Accepted
- **Date**: 2026-05-12
- **Decision-makers**: @architect, @auditor, @backend-dev
- **Context vote**: consensus-vote sprint 2 — top action #2

## Context

Sprint 2 introduces stateful authentication for both the storefront account flow and the admin UI. Refresh tokens live for days while access tokens live for minutes; if a refresh token is exfiltrated (XSS, log leak, intermediary proxy), the attacker gains a sliding window of impersonation. We need a mechanism that detects re-use of an already-rotated refresh token — the strongest available signal of a stolen credential — and contains the blast radius without forcing legitimate users to re-authenticate constantly.

Constraints: Postgres is the only durable store available in sprint 2 (no Redis-backed token registry yet); access tokens must remain stateless and verifiable without a DB roundtrip; the storefront uses cookies, third-party API consumers will eventually use Bearer headers; the EU jurisdiction forbids storing plaintext credentials.

Alternatives considered: (a) long-lived stateless refresh tokens with no rotation — rejected, no breach detection; (b) opaque server-side sessions only — rejected, breaks the eventual public API; (c) sliding rotation with a short grace window allowing the previous token to remain valid for N seconds — rejected, the grace window itself is the attack surface and complicates the breach signal.

## Decision

Sliding rotation with breach-detection. Every `POST /auth/refresh` call atomically marks the presented refresh token as `revoked`, issues a new access+refresh pair, and stores a sha256 hash of the new refresh token in the `RefreshToken` Prisma model. If a refresh token is presented that is already `revoked`, we treat it as a breach signal: every `RefreshToken` row for that user is revoked in the same transaction and an `auth.refresh.reuse_detected` event is appended to the audit log. There is no grace window. Access token TTL is 15 minutes; refresh token TTL is 30 days.

## Consequences

- **Positive**:
  - Stolen refresh tokens become useless the moment either party uses them once.
  - Reuse always invalidates the entire user session — strongest containment available.
  - Stateless access tokens keep the hot read path DB-free.
  - Hashing at rest means a DB dump cannot be replayed against the auth endpoint.
- **Negative**:
  - Concurrent tab refreshes can race and trigger a false-positive reuse detection. Mitigated by serializing refresh through a single in-flight promise on the client.
  - 30-day refresh TTL with no grace window forces re-login the moment a device's clock skews badly or a tab is suspended mid-rotation.
- **Trade-offs accepted**:
  - Slightly higher login friction in exchange for a clean breach signal.
  - One extra DB row per `/refresh` call; old rows pruned by a worker job after `revokedAt + 90 days`.

## Implementation notes

- Refresh tokens NEVER stored plaintext. Hash with sha256; the token is already 256 bits of entropy from `crypto.randomBytes(32)`, so no per-row salt is needed.
- Plaintext refresh token only ever leaves the server in an `HttpOnly`, `Secure`, `SameSite=Strict` cookie scoped to `Path=/auth/refresh`.
- `RefreshTokenRepository.rotate(presentedHash)` performs the revoke + insert in a single `prisma.$transaction([...])` to prevent torn state.
- JWT secrets: separate `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`, each ≥32 bytes random, validated by `EnvService` (see ADR 0010).
- Verifier configured with `algorithms: ['HS256']` explicitly. Reject `alg=none`. Never read `alg` from the JWT header to choose a verifier.
- Cascade revocation test required in PR-B: simulate reuse, assert all rows for the user become `revoked`, assert `auth.refresh.reuse_detected` audit row exists.
- Rate limit `/auth/refresh` per IP and per `userId` to blunt brute-force enumeration of token hashes.

## References

- Consensus vote architect/auditor/@backend-dev — sprint 2, top action #2
- OWASP ASVS v4 — Session Management (V3)
- RFC 6819 §5.2.2.3 — Refresh Token Rotation
- RFC 8725 — JWT Best Current Practices (BCP 225)
