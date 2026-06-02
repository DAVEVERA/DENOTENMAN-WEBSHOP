import { describe, it, expect } from "vitest";
import {
  redactHeaders,
  redactQueryString,
  shouldRedactBody,
  scrubEvent,
  scrubTransactionEvent,
  type ScrubbableEvent,
} from "./sentry-scrubber.js";

describe("redactHeaders", () => {
  it("strips Authorization header", () => {
    const result = redactHeaders({ Authorization: "Bearer secret-token" });
    expect(result).toEqual({ Authorization: "[REDACTED]" });
  });

  it("strips Cookie header (case-insensitive key)", () => {
    const result = redactHeaders({ cookie: "session=abc" });
    expect(result).toEqual({ cookie: "[REDACTED]" });
  });

  it("strips Set-Cookie header", () => {
    const result = redactHeaders({ "set-cookie": "id=1" });
    expect(result).toEqual({ "set-cookie": "[REDACTED]" });
  });

  it("strips X-CSRF-Token header", () => {
    const result = redactHeaders({ "x-csrf-token": "tok" });
    expect(result).toEqual({ "x-csrf-token": "[REDACTED]" });
  });

  it("strips Stripe-Signature header", () => {
    const result = redactHeaders({ "stripe-signature": "v1=abc" });
    expect(result).toEqual({ "stripe-signature": "[REDACTED]" });
  });

  it("keeps non-sensitive headers intact", () => {
    const result = redactHeaders({ "content-type": "application/json", accept: "text/html" });
    expect(result).toEqual({ "content-type": "application/json", accept: "text/html" });
  });

  it("returns undefined when headers is undefined", () => {
    expect(redactHeaders(undefined)).toBeUndefined();
  });
});

describe("redactQueryString", () => {
  it("replaces token= parameter", () => {
    expect(redactQueryString("?token=abc123")).toBe("token=[REDACTED]");
  });

  it("replaces code= parameter", () => {
    expect(redactQueryString("code=xyz")).toBe("code=[REDACTED]");
  });

  it("replaces session_id= parameter", () => {
    expect(redactQueryString("session_id=sess_abc")).toBe("session_id=[REDACTED]");
  });

  it("replaces mixed sensitive and safe parameters", () => {
    const result = redactQueryString("page=2&token=secret&lang=nl");
    expect(result).toBe("page=2&token=[REDACTED]&lang=nl");
  });

  it("leaves non-sensitive parameters untouched", () => {
    expect(redactQueryString("category=noten&page=1")).toBe("category=noten&page=1");
  });

  it("returns undefined when query is undefined", () => {
    expect(redactQueryString(undefined)).toBeUndefined();
  });
});

describe("shouldRedactBody", () => {
  it("returns true for /api/auth/ routes", () => {
    expect(shouldRedactBody("/api/auth/login")).toBe(true);
  });

  it("returns true for /checkout routes", () => {
    expect(shouldRedactBody("/checkout/confirm")).toBe(true);
  });

  it("returns true for /account routes", () => {
    expect(shouldRedactBody("/account/settings")).toBe(true);
  });

  it("returns true for /admin routes", () => {
    expect(shouldRedactBody("/admin/products")).toBe(true);
  });

  it("returns true for /v1/auth/ routes", () => {
    expect(shouldRedactBody("/v1/auth/refresh")).toBe(true);
  });

  it("returns false for safe public routes", () => {
    expect(shouldRedactBody("/shop/noten")).toBe(false);
  });

  it("returns false for undefined url", () => {
    expect(shouldRedactBody(undefined)).toBe(false);
  });
});

describe("scrubEvent", () => {
  it("strips Authorization header from request", () => {
    const event: ScrubbableEvent = {
      request: { headers: { Authorization: "Bearer tok" }, url: "/shop" },
    };
    const result = scrubEvent(event);
    expect(result.request?.headers).toEqual({ Authorization: "[REDACTED]" });
  });

  it("redacts body on /api/auth/ routes", () => {
    const event: ScrubbableEvent = {
      request: { url: "/api/auth/login", data: { password: "secret" } },
    };
    const result = scrubEvent(event);
    expect(result.request?.data).toBe("[REDACTED]");
  });

  it("does not redact body on safe routes", () => {
    const body = { productId: "abc" };
    const event: ScrubbableEvent = {
      request: { url: "/api/cart/add", data: body },
    };
    const result = scrubEvent(event);
    expect(result.request?.data).toEqual(body);
  });

  it("strips ?token= from request url query string", () => {
    const event: ScrubbableEvent = {
      request: { url: "/verify", query_string: "token=abc&lang=nl" },
    };
    const result = scrubEvent(event);
    expect(result.request?.query_string).toBe("token=[REDACTED]&lang=nl");
  });

  it("removes user.email", () => {
    const event: ScrubbableEvent = {
      user: { id: "u1", email: "user@example.com" },
    };
    const result = scrubEvent(event);
    expect(result.user?.email).toBeUndefined();
  });

  it("removes user.ip_address", () => {
    const event: ScrubbableEvent = {
      user: { id: "u1", ip_address: "1.2.3.4" },
    };
    const result = scrubEvent(event);
    expect(result.user?.ip_address).toBeUndefined();
  });

  it("keeps user.id intact", () => {
    const event: ScrubbableEvent = {
      user: { id: "u1", email: "user@example.com" },
    };
    const result = scrubEvent(event);
    expect(result.user?.id).toBe("u1");
  });
});

describe("scrubTransactionEvent", () => {
  it("strips Authorization header", () => {
    const event: ScrubbableEvent = {
      request: { headers: { Authorization: "Bearer tok" }, url: "/api/auth/me", data: "payload" },
    };
    const result = scrubTransactionEvent(event);
    expect(result.request?.headers).toEqual({ Authorization: "[REDACTED]" });
  });

  it("does NOT redact body on auth routes (transactions only scrub headers/qs)", () => {
    const event: ScrubbableEvent = {
      request: { url: "/api/auth/login", data: "payload" },
    };
    const result = scrubTransactionEvent(event);
    expect(result.request?.data).toBe("payload");
  });

  it("redacts token= from query string", () => {
    const event: ScrubbableEvent = {
      request: { url: "/verify", query_string: "?token=xyz" },
    };
    const result = scrubTransactionEvent(event);
    expect(result.request?.query_string).toBe("token=[REDACTED]");
  });
});
