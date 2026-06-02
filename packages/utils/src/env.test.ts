import { describe, it, expect, vi, afterEach } from "vitest";
import { z } from "zod";
import { parseEnv } from "./env.js";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().int().positive().default(3000),
  API_KEY: z.string().min(8),
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseEnv", () => {
  it("happy path — valid input returns typed object", () => {
    const result = parseEnv(schema, {
      DATABASE_URL: "postgresql://localhost/test",
      PORT: "4000",
      API_KEY: "12345678",
    });

    expect(result.DATABASE_URL).toBe("postgresql://localhost/test");
    expect(result.PORT).toBe(4000);
    expect(result.API_KEY).toBe("12345678");
  });

  it("default values are applied when key is absent", () => {
    const result = parseEnv(schema, {
      DATABASE_URL: "postgresql://localhost/test",
      API_KEY: "12345678",
    });

    expect(result.PORT).toBe(3000);
  });

  it("missing required key — throws and error message names the key", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() =>
      parseEnv(schema, {
        DATABASE_URL: "postgresql://localhost/test",
        // API_KEY intentionally missing
      }),
    ).toThrow("Environment validation failed");

    expect(errorSpy).toHaveBeenCalledOnce();
    const logged = errorSpy.mock.calls[0]?.[0] as string;
    expect(logged).toContain("API_KEY");
  });

  it("malformed value (invalid URL) — throws", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() =>
      parseEnv(schema, {
        DATABASE_URL: "not-a-valid-url",
        API_KEY: "12345678",
      }),
    ).toThrow("Environment validation failed");
  });

  it("secret-redaction — throw message does not contain the secret value", () => {
    const secretSchema = z.object({
      SECRET_KEY: z.string().min(32),
    });

    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const shortSecret = "too-short-secret";

    let thrownMessage = "";
    try {
      parseEnv(secretSchema, { SECRET_KEY: shortSecret });
    } catch (err: unknown) {
      thrownMessage = err instanceof Error ? err.message : String(err);
    }

    expect(thrownMessage).not.toContain(shortSecret);
  });
});
