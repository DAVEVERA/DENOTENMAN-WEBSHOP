import { describe, it, expect, vi, afterEach } from "vitest";
import { createEnv } from "../env";

// Minimal valid base input for all tests to build on.
const BASE = {
  NODE_ENV: "development",
  DATABASE_URL: "postgresql://localhost/test",
  JWT_ACCESS_SECRET: "a".repeat(32),
  JWT_REFRESH_SECRET: "b".repeat(32),
  CSRF_SECRET: "c".repeat(32),
} as const;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createEnv — API schema", () => {
  it("happy path — valid input returns typed object with defaults", () => {
    const result = createEnv({ ...BASE });

    expect(result.NODE_ENV).toBe("development");
    expect(result.PORT).toBe(3001);
    expect(result.JWT_ACCESS_TTL).toBe("15m");
    expect(result.JWT_REFRESH_TTL).toBe("30d");
  });

  it("missing JWT_ACCESS_SECRET — throws", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { JWT_ACCESS_SECRET: _omit, ...withoutSecret } = BASE;
    expect(() => createEnv({ ...withoutSecret })).toThrow("Environment validation failed");
  });

  it("JWT_ACCESS_SECRET too short (< 32 chars) — throws", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() =>
      createEnv({
        ...BASE,
        JWT_ACCESS_SECRET: "tooshort",
      }),
    ).toThrow("Environment validation failed");
  });

  it("production without STOREFRONT_URL — throws", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() =>
      createEnv({
        ...BASE,
        NODE_ENV: "production",
        ADMIN_URL: "https://admin.denotenman.nl",
        STRIPE_SECRET_KEY: "sk_live_test",
        STRIPE_WEBHOOK_SECRET: "whsec_live_test",
      }),
    ).toThrow("Environment validation failed");
  });

  it("development without STRIPE_SECRET_KEY — ok", () => {
    const result = createEnv({ ...BASE, NODE_ENV: "development" });
    expect(result.STRIPE_SECRET_KEY).toBeUndefined();
  });

  it("production without STRIPE_SECRET_KEY — throws", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() =>
      createEnv({
        ...BASE,
        NODE_ENV: "production",
        STOREFRONT_URL: "https://denotenman.nl",
        ADMIN_URL: "https://admin.denotenman.nl",
        // STRIPE_SECRET_KEY intentionally absent
      }),
    ).toThrow("Environment validation failed");
  });

  it("STRIPE_WEBHOOK_SECRET without whsec_ prefix — throws", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() =>
      createEnv({
        ...BASE,
        STRIPE_SECRET_KEY: "sk_test_abc",
        STRIPE_WEBHOOK_SECRET: "not_a_valid_secret",
      }),
    ).toThrow("Environment validation failed");
  });

  it("STRIPE_SECRET_KEY set but STRIPE_WEBHOOK_SECRET absent — throws", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() =>
      createEnv({
        ...BASE,
        STRIPE_SECRET_KEY: "sk_test_abc",
        // STRIPE_WEBHOOK_SECRET absent
      }),
    ).toThrow("Environment validation failed");
  });

  it("invalid DATABASE_URL (not a URL) — throws", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() =>
      createEnv({
        ...BASE,
        DATABASE_URL: "not-a-url",
      }),
    ).toThrow("Environment validation failed");
  });

  it("PORT is coerced from string to number", () => {
    const result = createEnv({ ...BASE, PORT: "4200" });
    expect(result.PORT).toBe(4200);
    expect(typeof result.PORT).toBe("number");
  });
});
