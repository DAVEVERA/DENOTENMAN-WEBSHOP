import { describe, it, expect, vi, beforeEach } from "vitest";
import { createApiClient } from "./client.js";
import { ApiError } from "./errors.js";

const UUID = "550e8400-e29b-41d4-a716-446655440000";
const UUID2 = "550e8400-e29b-41d4-a716-446655440001";
const UUID3 = "550e8400-e29b-41d4-a716-446655440002";
const UUID4 = "550e8400-e29b-41d4-a716-446655440003";

function makeResponse(body: unknown, status = 200): Response {
  const json = JSON.stringify(body);
  return new Response(json, {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function makeErrorResponse(body: unknown, status: number): Response {
  const json = JSON.stringify(body);
  return new Response(json, {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const mockFetch = vi.fn<typeof fetch>();

function lastCall(): [string | URL | Request, RequestInit] {
  const call = mockFetch.mock.calls.at(-1);
  if (!call) {
    throw new Error("fetch was not called");
  }
  const [url, init] = call;
  if (init === undefined) {
    throw new Error("fetch init missing");
  }
  return [url, init];
}

function client(getAccessToken?: () => string | null) {
  return createApiClient({
    baseUrl: "https://api.example.com",
    fetch: mockFetch,
    ...(getAccessToken !== undefined ? { getAccessToken } : {}),
  });
}

const validUser = {
  id: UUID,
  email: "jan@voorbeeld.nl",
  role: "customer",
  emailVerifiedAt: null,
  lastLoginAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  deletedAt: null,
};

const validCategory = {
  id: UUID2,
  slug: "noten",
  name: "Noten",
  description: null,
  parentId: null,
  sortOrder: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  deletedAt: null,
};

const validProduct = {
  id: UUID,
  sku: "HAZ-001",
  slug: "hazelnoot",
  name: "Hazelnoot",
  description: null,
  categoryId: UUID2,
  status: "active",
  origin: null,
  harvestYear: null,
  roasted: null,
  organic: false,
  allergens: [],
  ingredients: null,
  storageInfo: null,
  tasteNotes: null,
  usageTip: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  deletedAt: null,
  variants: [],
  images: [],
  tags: [],
  category: validCategory,
};

const validCartLine = {
  id: UUID2,
  cartId: UUID,
  productId: UUID3,
  variantId: UUID4,
  quantity: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const validCart = {
  id: UUID,
  customerId: null,
  token: "tok-abc",
  currency: "EUR",
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  lines: [validCartLine],
};

const validOrder = {
  id: UUID,
  orderNumber: "ORD-001",
  customerId: null,
  guestEmail: null,
  status: "pending",
  currency: "EUR",
  subtotalCents: 175,
  shippingCents: 495,
  taxCents: 50,
  totalCents: 720,
  shippingAddressId: UUID2,
  billingAddressId: null,
  stripeSessionId: null,
  stripePaymentIntent: null,
  paidAt: null,
  fulfilledAt: null,
  cancelledAt: null,
  notes: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  lines: [],
};

beforeEach(() => {
  mockFetch.mockReset();
});

describe("auth.login", () => {
  it("POSTs to /auth/login and returns user + accessToken", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ user: validUser, accessToken: "tok-123" }));

    const result = await client().auth.login({
      email: "jan@voorbeeld.nl",
      password: "geheim",
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = lastCall();
    expect(url).toBe("https://api.example.com/auth/login");
    expect(init.method).toBe("POST");
    expect(result.accessToken).toBe("tok-123");
    expect(result.user.email).toBe("jan@voorbeeld.nl");
  });

  it("attaches Bearer token when getAccessToken returns one", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ user: validUser, accessToken: "tok-new" }));

    await client(() => "existing-token").auth.login({
      email: "jan@voorbeeld.nl",
      password: "geheim",
    });

    const [, init] = lastCall();
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer existing-token");
  });
});

describe("auth.refresh", () => {
  it("POSTs to /auth/refresh", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ accessToken: "tok-new" }));

    const result = await client().auth.refresh();

    const [url, init] = lastCall();
    expect(url).toBe("https://api.example.com/auth/refresh");
    expect(init.method).toBe("POST");
    expect(result.accessToken).toBe("tok-new");
  });
});

describe("auth.logout", () => {
  it("POSTs to /auth/logout", async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await client().auth.logout();

    const [url, init] = lastCall();
    expect(url).toBe("https://api.example.com/auth/logout");
    expect(init.method).toBe("POST");
  });
});

describe("products.list", () => {
  it("GETs /products and returns paginated products", async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({ items: [validProduct], page: 1, pageSize: 20, total: 1 }),
    );

    const result = await client().products.list();

    const [url, init] = lastCall();
    expect(url).toBe("https://api.example.com/products");
    expect(init.method).toBe("GET");
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it("appends query params when provided", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ items: [], page: 2, pageSize: 10, total: 0 }));

    await client().products.list({ page: 2, pageSize: 10 });

    const [url] = lastCall();
    expect(url as string).toContain("page=2");
    expect(url as string).toContain("pageSize=10");
  });
});

describe("products.getBySlug", () => {
  it("GETs /products/:slug", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(validProduct));

    const result = await client().products.getBySlug("hazelnoot");

    const [url] = lastCall();
    expect(url).toBe("https://api.example.com/products/hazelnoot");
    expect(result.slug).toBe("hazelnoot");
  });
});

describe("cart.get", () => {
  it("GETs /cart", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(validCart));

    const result = await client().cart.get();

    const [url] = lastCall();
    expect(url).toBe("https://api.example.com/cart");
    expect(result.token).toBe("tok-abc");
  });
});

describe("cart.addLine", () => {
  it("POSTs to /cart/lines with body", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(validCart));

    await client().cart.addLine({ variantId: UUID4, quantity: 2 });

    const [url, init] = lastCall();
    expect(url).toBe("https://api.example.com/cart/lines");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string) as unknown;
    expect(body).toEqual({ variantId: UUID4, quantity: 2 });
  });
});

describe("cart.updateLine", () => {
  it("PATCHes /cart/lines/:id", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(validCart));

    await client().cart.updateLine(UUID2, { quantity: 3 });

    const [url, init] = lastCall();
    expect(url).toBe(`https://api.example.com/cart/lines/${UUID2}`);
    expect(init.method).toBe("PATCH");
  });
});

describe("cart.removeLine", () => {
  it("DELETEs /cart/lines/:id", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(validCart));

    await client().cart.removeLine(UUID2);

    const [url, init] = lastCall();
    expect(url).toBe(`https://api.example.com/cart/lines/${UUID2}`);
    expect(init.method).toBe("DELETE");
  });
});

describe("orders.create", () => {
  it("POSTs to /orders with body", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(validOrder));

    await client().orders.create({ shippingAddressId: UUID2 });

    const [url, init] = lastCall();
    expect(url).toBe("https://api.example.com/orders");
    expect(init.method).toBe("POST");
  });
});

describe("orders.getById", () => {
  it("GETs /orders/:id", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(validOrder));

    const result = await client().orders.getById(UUID);

    const [url] = lastCall();
    expect(url).toBe(`https://api.example.com/orders/${UUID}`);
    expect(result.orderNumber).toBe("ORD-001");
  });
});

describe("error handling", () => {
  it("throws ApiError on 401 response", async () => {
    mockFetch.mockResolvedValueOnce(
      makeErrorResponse({ code: "UNAUTHORIZED", message: "Not authenticated" }, 401),
    );

    await expect(client().products.list()).rejects.toThrow(ApiError);
  });

  it("ApiError carries correct status and code", async () => {
    mockFetch.mockResolvedValueOnce(
      makeErrorResponse({ code: "NOT_FOUND", message: "Product not found" }, 404),
    );

    try {
      await client().products.getBySlug("onbekend");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(404);
      expect(apiErr.code).toBe("NOT_FOUND");
    }
  });

  it("throws ApiError with SCHEMA_MISMATCH on invalid response shape", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ totally: "wrong" }));

    try {
      await client().products.getBySlug("hazelnoot");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.code).toBe("SCHEMA_MISMATCH");
    }
  });

  it("throws ApiError with UNKNOWN code when error body is not JSON error shape", async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse({ random: "body" }, 500));

    try {
      await client().products.list();
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(500);
      expect(apiErr.code).toBe("UNKNOWN");
    }
  });

  it("includes credentials: include on all requests", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(validCart));

    await client().cart.get();

    const [, init] = lastCall();
    expect(init.credentials).toBe("include");
  });
});
