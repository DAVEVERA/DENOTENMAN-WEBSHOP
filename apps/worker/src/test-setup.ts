// Test environment bootstrap.
// Sets required env vars before any module is imported, so the env singleton
// (apps/worker/src/env.ts) can initialise without throwing.

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.REDIS_URL = "redis://localhost:6379";
