import { describe, it, expect, vi, afterEach } from "vitest";
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
import { beforeSend, beforeSendTransaction } from "../sentry";

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
        authorization: "Bearer worker-token",
        cookie: "session=xyz",
        "set-cookie": "session=xyz; HttpOnly",
        "x-csrf-token": "csrf-val",
        "stripe-signature": "t=1,v1=sig",
      },
      query_string: "token=secret&code=abc&session_id=sess&other=keep",
      data: { name: "product" },
    },
    user: {
      id: "worker-user-1",
      email: "jan@denotenman.com",
      ip_address: "10.0.0.1",
    },
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// beforeSend — PII scrubbing
// ---------------------------------------------------------------------------

describe("beforeSend (worker)", () => {
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

  it("strips Stripe-Signature header", () => {
    const event = makeEvent();
    const result = beforeSend(event, {});

    expect(result?.request?.headers?.["stripe-signature"]).toBe("[REDACTED]");
  });

  it("redacts body on /v1/auth/ routes", () => {
    const event = makeEvent({
      request: {
        url: "/v1/auth/login",
        data: { password: "secret" },
        headers: {},
        query_string: "",
      },
    });
    const result = beforeSend(event, {});

    expect(result?.request?.data).toBe("[REDACTED]");
  });

  it("redacts ?token= query parameter", () => {
    const event = makeEvent({
      request: {
        url: "/v1/verify",
        headers: {},
        query_string: "token=mysecret",
      },
    });
    const result = beforeSend(event, {});

    expect(result?.request?.query_string).toBe("token=[REDACTED]");
  });

  it("redacts ?code= query parameter", () => {
    const event = makeEvent({
      request: { url: "/v1/verify", headers: {}, query_string: "code=xyz" },
    });
    const result = beforeSend(event, {});

    expect(result?.request?.query_string).toBe("code=[REDACTED]");
  });

  it("redacts ?session_id= query parameter", () => {
    const event = makeEvent({
      request: {
        url: "/v1/products",
        headers: {},
        query_string: "session_id=abc&page=1",
      },
    });
    const result = beforeSend(event, {});

    expect(result?.request?.query_string).toBe("session_id=[REDACTED]&page=1");
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

  it("preserves user.id", () => {
    const event = makeEvent();
    const result = beforeSend(event, {});

    expect(result?.user?.id).toBe("worker-user-1");
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
        authorization: "Bearer worker-token",
      },
      query_string: "token=secret",
      ...request,
    },
  };
}

describe("beforeSendTransaction (worker)", () => {
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
