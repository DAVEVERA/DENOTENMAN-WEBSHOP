import { describe, it, expect } from "vitest";
import { ShippingRuleSchema, ShippingQuoteSchema } from "./shipping.js";

const validRule = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  country: "NL" as const,
  name: "Standaard bezorging",
  baseCostCents: 495,
  freeAboveCents: 5000,
  estimatedDays: 2,
  active: true,
  sortOrder: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("ShippingRuleSchema", () => {
  it("accepts valid rule", () => {
    const result = ShippingRuleSchema.parse(validRule);
    expect(result.baseCostCents).toBe(495);
  });

  it("accepts rule with null freeAboveCents", () => {
    const result = ShippingRuleSchema.parse({ ...validRule, freeAboveCents: null });
    expect(result.freeAboveCents).toBeNull();
  });

  it("rejects unsupported country", () => {
    expect(() => ShippingRuleSchema.parse({ ...validRule, country: "DE" })).toThrow();
  });

  it("rejects negative baseCostCents", () => {
    expect(() => ShippingRuleSchema.parse({ ...validRule, baseCostCents: -1 })).toThrow();
  });

  it("rejects estimatedDays of zero", () => {
    expect(() => ShippingRuleSchema.parse({ ...validRule, estimatedDays: 0 })).toThrow();
  });
});

describe("ShippingQuoteSchema", () => {
  it("accepts valid quote", () => {
    const result = ShippingQuoteSchema.parse({
      ruleId: "550e8400-e29b-41d4-a716-446655440000",
      name: "Standaard bezorging",
      costCents: 0,
      estimatedDays: 2,
      isFree: true,
    });
    expect(result.isFree).toBe(true);
  });

  it("rejects negative costCents", () => {
    expect(() =>
      ShippingQuoteSchema.parse({
        ruleId: "550e8400-e29b-41d4-a716-446655440000",
        name: "Test",
        costCents: -1,
        estimatedDays: 2,
        isFree: false,
      }),
    ).toThrow();
  });
});
