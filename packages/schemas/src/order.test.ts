import { describe, it, expect } from "vitest";
import {
  OrderSchema,
  OrderLineSchema,
  OrderStatusSchema,
  CreateOrderSchema,
  AddressSchema,
} from "./order.js";

const validAddress = {
  id: "550e8400-e29b-41d4-a716-446655440010",
  customerId: "550e8400-e29b-41d4-a716-446655440011",
  label: "Thuis",
  firstName: "Jan",
  lastName: "Janssen",
  companyName: null,
  street: "Dorpstraat",
  houseNumber: "1",
  addition: null,
  postalCode: "1234AB",
  city: "Amsterdam",
  country: "NL" as const,
  phoneNumber: null,
  isDefault: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const validLine = {
  id: "550e8400-e29b-41d4-a716-446655440012",
  orderId: "550e8400-e29b-41d4-a716-446655440000",
  productId: "550e8400-e29b-41d4-a716-446655440002",
  variantId: "550e8400-e29b-41d4-a716-446655440003",
  productName: "Hazelnoot",
  variantName: "50g",
  unitPriceCents: 175,
  quantity: 2,
  totalCents: 350,
  createdAt: new Date().toISOString(),
};

const validOrder = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  orderNumber: "ORD-2026-001",
  customerId: null,
  guestEmail: "gast@voorbeeld.nl",
  status: "pending" as const,
  currency: "EUR",
  subtotalCents: 350,
  shippingCents: 495,
  taxCents: 87,
  totalCents: 845,
  shippingAddressId: "550e8400-e29b-41d4-a716-446655440010",
  billingAddressId: null,
  stripeSessionId: null,
  stripePaymentIntent: null,
  paidAt: null,
  fulfilledAt: null,
  cancelledAt: null,
  notes: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  lines: [validLine],
};

describe("OrderStatusSchema", () => {
  it("accepts all valid statuses", () => {
    const statuses = ["pending", "paid", "fulfilled", "cancelled", "refunded"] as const;
    for (const s of statuses) {
      expect(OrderStatusSchema.parse(s)).toBe(s);
    }
  });

  it("rejects unknown status", () => {
    expect(() => OrderStatusSchema.parse("shipped")).toThrow();
  });
});

describe("AddressSchema", () => {
  it("accepts valid address", () => {
    const result = AddressSchema.parse(validAddress);
    expect(result.country).toBe("NL");
  });

  it("rejects unsupported country", () => {
    expect(() => AddressSchema.parse({ ...validAddress, country: "DE" })).toThrow();
  });
});

describe("OrderLineSchema", () => {
  it("accepts valid line", () => {
    const result = OrderLineSchema.parse(validLine);
    expect(result.totalCents).toBe(350);
  });

  it("rejects negative unitPriceCents", () => {
    expect(() => OrderLineSchema.parse({ ...validLine, unitPriceCents: -1 })).toThrow();
  });

  it("rejects quantity of zero", () => {
    expect(() => OrderLineSchema.parse({ ...validLine, quantity: 0 })).toThrow();
  });
});

describe("OrderSchema", () => {
  it("accepts valid order", () => {
    const result = OrderSchema.parse(validOrder);
    expect(result.orderNumber).toBe("ORD-2026-001");
  });

  it("rejects invalid guestEmail", () => {
    expect(() => OrderSchema.parse({ ...validOrder, guestEmail: "not-an-email" })).toThrow();
  });

  it("rejects negative totalCents", () => {
    expect(() => OrderSchema.parse({ ...validOrder, totalCents: -1 })).toThrow();
  });
});

describe("CreateOrderSchema", () => {
  it("accepts minimal input with shippingAddressId only", () => {
    const result = CreateOrderSchema.parse({
      shippingAddressId: "550e8400-e29b-41d4-a716-446655440010",
    });
    expect(result.shippingAddressId).toBeDefined();
  });

  it("rejects missing shippingAddressId", () => {
    expect(() => CreateOrderSchema.parse({})).toThrow();
  });
});
