import { describe, it, expect } from "vitest";
import { CartSchema, CartLineSchema, AddToCartSchema, UpdateCartLineSchema } from "./cart.js";

const validLine = {
  id: "550e8400-e29b-41d4-a716-446655440001",
  cartId: "550e8400-e29b-41d4-a716-446655440000",
  productId: "550e8400-e29b-41d4-a716-446655440002",
  variantId: "550e8400-e29b-41d4-a716-446655440003",
  quantity: 2,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const validCart = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  customerId: null,
  token: "tok-abc123",
  currency: "EUR",
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  lines: [validLine],
};

describe("CartLineSchema", () => {
  it("accepts valid cart line", () => {
    const result = CartLineSchema.parse(validLine);
    expect(result.quantity).toBe(2);
  });

  it("rejects quantity of zero", () => {
    expect(() => CartLineSchema.parse({ ...validLine, quantity: 0 })).toThrow();
  });

  it("rejects negative quantity", () => {
    expect(() => CartLineSchema.parse({ ...validLine, quantity: -1 })).toThrow();
  });

  it("rejects invalid cartId uuid", () => {
    expect(() => CartLineSchema.parse({ ...validLine, cartId: "bad" })).toThrow();
  });
});

describe("CartSchema", () => {
  it("accepts valid cart", () => {
    const result = CartSchema.parse(validCart);
    expect(result.lines).toHaveLength(1);
  });

  it("accepts cart with no customer (guest)", () => {
    const result = CartSchema.parse({ ...validCart, customerId: null });
    expect(result.customerId).toBeNull();
  });

  it("rejects currency that is not 3 chars", () => {
    expect(() => CartSchema.parse({ ...validCart, currency: "EU" })).toThrow();
  });
});

describe("AddToCartSchema", () => {
  it("accepts valid input", () => {
    const result = AddToCartSchema.parse({
      variantId: "550e8400-e29b-41d4-a716-446655440003",
      quantity: 1,
    });
    expect(result.quantity).toBe(1);
  });

  it("rejects quantity of zero", () => {
    expect(() =>
      AddToCartSchema.parse({
        variantId: "550e8400-e29b-41d4-a716-446655440003",
        quantity: 0,
      }),
    ).toThrow();
  });
});

describe("UpdateCartLineSchema", () => {
  it("accepts valid quantity", () => {
    const result = UpdateCartLineSchema.parse({ quantity: 3 });
    expect(result.quantity).toBe(3);
  });

  it("rejects quantity of zero", () => {
    expect(() => UpdateCartLineSchema.parse({ quantity: 0 })).toThrow();
  });
});
