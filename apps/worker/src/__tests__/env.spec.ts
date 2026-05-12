import { describe, it, expect, vi, afterEach } from "vitest";
import { createWorkerEnv } from "../env";

const BASE = {
  NODE_ENV: "development",
  DATABASE_URL: "postgresql://localhost/worker_test",
  REDIS_URL: "redis://localhost:6379",
} as const;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createWorkerEnv — worker schema", () => {
  it("happy path — valid input returns typed object with defaults", () => {
    const result = createWorkerEnv({ ...BASE });

    expect(result.NODE_ENV).toBe("development");
    expect(result.WORKER_PORT).toBe(3002);
    expect(result.REDIS_URL).toBe("redis://localhost:6379");
  });

  it("custom WORKER_PORT — coerced from string to number", () => {
    const result = createWorkerEnv({ ...BASE, WORKER_PORT: "4002" });
    expect(result.WORKER_PORT).toBe(4002);
    expect(typeof result.WORKER_PORT).toBe("number");
  });

  it("missing REDIS_URL — throws", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { REDIS_URL: _omit, ...withoutRedis } = BASE;
    expect(() => createWorkerEnv({ ...withoutRedis })).toThrow("Environment validation failed");
  });

  it("missing DATABASE_URL — throws", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { DATABASE_URL: _omit, ...withoutDb } = BASE;
    expect(() => createWorkerEnv({ ...withoutDb })).toThrow("Environment validation failed");
  });

  it("invalid REDIS_URL (not a URL) — throws", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() =>
      createWorkerEnv({
        ...BASE,
        REDIS_URL: "not-a-valid-url",
      }),
    ).toThrow("Environment validation failed");
  });

  it("SENTRY_DSN is optional — valid without it", () => {
    const result = createWorkerEnv({ ...BASE });
    expect(result.SENTRY_DSN).toBeUndefined();
  });

  it("SENTRY_ENVIRONMENT is optional — valid without it", () => {
    const result = createWorkerEnv({ ...BASE });
    expect(result.SENTRY_ENVIRONMENT).toBeUndefined();
  });

  it("SENTRY_ENVIRONMENT is read when provided", () => {
    const result = createWorkerEnv({ ...BASE, SENTRY_ENVIRONMENT: "staging" });
    expect(result.SENTRY_ENVIRONMENT).toBe("staging");
  });
});
