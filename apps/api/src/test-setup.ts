// Test environment bootstrap.
// Sets required env vars before any module is imported, so the env singleton
// (apps/api/src/env.ts) can initialise without throwing.
// Values here are for tests only — they are never valid secrets.

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.JWT_ACCESS_SECRET = "a".repeat(32);
process.env.JWT_REFRESH_SECRET = "b".repeat(32);
process.env.CSRF_SECRET = "c".repeat(32);
