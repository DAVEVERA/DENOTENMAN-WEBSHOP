import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ErrorEvent } from "@sentry/node";

// Mock the Sentry SDK and profiling-node before importing the module under test.
vi.mock("@sentry/node", () => ({
  init: vi.fn(),
  captureException: vi.fn(),
  setupFastifyErrorHandler: vi.fn(),
}));

vi.mock("@sentry/profiling-node", () => ({
  nodeProfilingIntegration: vi.fn(() => ({})),
}));

// Import after mocks are in place.
import { beforeSend, beforeSendTransaction, hashUserId } from "../sentry";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(overrides: Partial<ErrorEvent> = {}): ErrorEvent {
  return {
    type: undefined,
    request: {
      url: "/v1/products",
      headers: {
        accept: "application/json",
        authorization: "Bearer secret-token",
        cookie: "session=abc",
        "set-cookie": "session=abc; HttpOnly",
        "x-csrf-token": "csrf-value",
        "stripe-signature": "t=12345,v1=abcdef",
      },
      query_string: "page=1&token=secret123&code=abc&other=keep",
      data: { name: "some product" },
    },
    user: {
      id: "user-42",
      email: "jan@denotenman.com",
      ip_address: "192.168.1.1",
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// beforeEach / afterEach
// ---------------------------------------------------------------------------

beforeEach(() => {
  delete process.env.SENTRY_USER_ID_PEPPER;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// beforeSend — PII scrubbing
// ---------------------------------------------------------------------------

describe("beforeSend", () => {
  it("strips Authorization header", () => {
    const event = makeEvent();
    const result = beforeSend(event, {});

    expect(result?.request?.headers?.authorization).toBe("[REDACTED]");
  });

  it("strips Cookie header", () => {
    const event = makeEvent();
    const result = beforeSend(event, {});

    expect(result?.request?.headers?.cookie).toBe("[REDACTED]");
  });

  it("strips Set-Cookie header", () => {
    const event = makeEvent();
    const result = beforeSend(event, {});

    expect(result?.request?.headers?.["set-cookie"]).toBe("[REDACTED]");
  });

  it("strips X-CSRF-Token header", () => {
    const event = makeEvent();
    const result = beforeSend(event, {});

    expect(result?.request?.headers?.["x-csrf-token"]).toBe("[REDACTED]");
  });

  it("strips Stripe-Signature header", () => {
    const event = makeEvent();
    const result = beforeSend(event, {});

    expect(result?.request?.headers?.["stripe-signature"]).toBe("[REDACTED]");
  });

  it("preserves non-sensitive headers", () => {
    const event = makeEvent();
    const result = beforeSend(event, {});

    expect(result?.request?.headers?.accept).toBe("application/json");
  });

  it("redacts body on /v1/auth/ routes", () => {
    const event = makeEvent({
      request: {
        url: "/v1/auth/login",
        data: { email: "jan@denotenman.com", password: "supersecret" },
        headers: {},
        query_string: "",
      },
    });
    const result = beforeSend(event, {});

    expect(result?.request?.data).toBe("[REDACTED]");
  });

  it("redacts body on /v1/checkout routes", () => {
    const event = makeEvent({
      request: {
        url: "/v1/checkout",
        data: { card: "4242424242424242" },
        headers: {},
        query_string: "",
      },
    });
    const result = beforeSend(event, {});

    expect(result?.request?.data).toBe("[REDACTED]");
  });

  it("redacts body on /v1/admin/ routes", () => {
    const event = makeEvent({
      request: {
        url: "/v1/admin/users",
        data: { role: "admin" },
        headers: {},
        query_string: "",
      },
    });
    const result = beforeSend(event, {});

    expect(result?.request?.data).toBe("[REDACTED]");
  });

  it("preserves body on non-sensitive routes", () => {
    const event = makeEvent({
      request: {
        url: "/v1/products/123",
        data: { name: "Hazelnoten" },
        headers: {},
        query_string: "",
      },
    });
    const result = beforeSend(event, {});

    expect(result?.request?.data).toEqual({ name: "Hazelnoten" });
  });

  it("redacts ?token= query parameter", () => {
    const event = makeEvent({
      request: {
        url: "/v1/verify",
        headers: {},
        query_string: "token=mysecrettoken&other=keep",
      },
    });
    const result = beforeSend(event, {});

    expect(result?.request?.query_string).toBe("token=[REDACTED]&other=keep");
  });

  it("redacts ?code= query parameter", () => {
    const event = makeEvent({
      request: {
        url: "/v1/verify",
        headers: {},
        query_string: "code=abc123",
      },
    });
    const result = beforeSend(event, {});

    expect(result?.request?.query_string).toBe("code=[REDACTED]");
  });

  it("redacts ?session_id= query parameter", () => {
    const event = makeEvent({
      request: {
        url: "/v1/products",
        headers: {},
        query_string: "session_id=sess_xyz&page=1",
      },
    });
    const result = beforeSend(event, {});

    expect(result?.request?.query_string).toBe("session_id=[REDACTED]&page=1");
  });

  it("preserves non-sensitive query parameters", () => {
    const event = makeEvent({
      request: {
        url: "/v1/products",
        headers: {},
        query_string: "page=2&limit=20",
      },
    });
    const result = beforeSend(event, {});

    expect(result?.request?.query_string).toBe("page=2&limit=20");
  });

  it("drops user.email", () => {
    const event = makeEvent();
    const result = beforeSend(event, {});

    expect(result?.user).not.toHaveProperty("email");
  });

  it("drops user.ip_address", () => {
    const event = makeEvent();
    const result = beforeSend(event, {});

    expect(result?.user).not.toHaveProperty("ip_address");
  });

  it("preserves user.id after PII removal", () => {
    const event = makeEvent();
    const result = beforeSend(event, {});

    expect(result?.user?.id).toBe("user-42");
  });

  it("handles event without request gracefully", () => {
    const event: ErrorEvent = { type: undefined };
    const result = beforeSend(event, {});

    expect(result).toBe(event);
  });

  it("handles event without user gracefully", () => {
    const event: ErrorEvent = {
      type: undefined,
      request: { url: "/v1/products", headers: {} },
    };
    const result = beforeSend(event, {});

    expect(result?.user).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// beforeSendTransaction
// ---------------------------------------------------------------------------

// Transaction events have type: "transaction" — distinct from ErrorEvent.
type TxEvent = Parameters<typeof beforeSendTransaction>[0];

function makeTxEvent(request: TxEvent["request"] = {}): TxEvent {
  return {
    type: "transaction",
    request: {
      headers: {
        accept: "application/json",
        authorization: "Bearer secret-token",
      },
      query_string: "token=secret",
      ...request,
    },
  };
}

describe("beforeSendTransaction", () => {
  it("strips Authorization header", () => {
    const event = makeTxEvent();
    const result = beforeSendTransaction(event, {});

    expect(result?.request?.headers?.authorization).toBe("[REDACTED]");
  });

  it("redacts token query param", () => {
    const event = makeTxEvent({ url: "/v1/products", headers: {}, query_string: "token=abc" });
    const result = beforeSendTransaction(event, {});

    expect(result?.request?.query_string).toBe("token=[REDACTED]");
  });
});

// ---------------------------------------------------------------------------
// hashUserId
// ---------------------------------------------------------------------------

describe("hashUserId", () => {
  it("produces a deterministic hex string", () => {
    const hash1 = hashUserId("user-123");
    const hash2 = hashUserId("user-123");

    expect(hash1).toBe(hash2);
    expect(/^[0-9a-f]+$/.test(hash1)).toBe(true);
  });

  it("produces a 16-character string", () => {
    const hash = hashUserId("user-abc");

    expect(hash).toHaveLength(16);
  });

  it("produces different hashes for different ids", () => {
    const hash1 = hashUserId("user-1");
    const hash2 = hashUserId("user-2");

    expect(hash1).not.toBe(hash2);
  });

  it("incorporates pepper when SENTRY_USER_ID_PEPPER is set", () => {
    process.env.SENTRY_USER_ID_PEPPER = "test-pepper";
    const hashWithPepper = hashUserId("user-123");

    delete process.env.SENTRY_USER_ID_PEPPER;
    const hashWithoutPepper = hashUserId("user-123");

    expect(hashWithPepper).not.toBe(hashWithoutPepper);
  });
});
