import { describe, it, expect } from "vitest";
import { AdminStatsSchema } from "./admin.js";

const validStats = {
  totalOrders: 42,
  pendingOrders: 5,
  paidOrders: 10,
  fulfilledOrders: 27,
  revenueThisMonth: 150000,
  totalProducts: 80,
  activeProducts: 65,
  totalCategories: 8,
};

describe("AdminStatsSchema", () => {
  it("accepts valid stats", () => {
    const result = AdminStatsSchema.parse(validStats);
    expect(result.totalOrders).toBe(42);
    expect(result.revenueThisMonth).toBe(150000);
  });

  it("accepts zero values", () => {
    const result = AdminStatsSchema.parse({
      totalOrders: 0,
      pendingOrders: 0,
      paidOrders: 0,
      fulfilledOrders: 0,
      revenueThisMonth: 0,
      totalProducts: 0,
      activeProducts: 0,
      totalCategories: 0,
    });
    expect(result.totalOrders).toBe(0);
  });

  it("rejects negative totalOrders", () => {
    expect(() => AdminStatsSchema.parse({ ...validStats, totalOrders: -1 })).toThrow();
  });

  it("rejects negative revenueThisMonth", () => {
    expect(() => AdminStatsSchema.parse({ ...validStats, revenueThisMonth: -1 })).toThrow();
  });

  it("rejects float revenueThisMonth", () => {
    expect(() => AdminStatsSchema.parse({ ...validStats, revenueThisMonth: 1.5 })).toThrow();
  });

  it("rejects missing field", () => {
    const { totalOrders: _omitted, ...withoutTotal } = validStats;
    expect(() => AdminStatsSchema.parse(withoutTotal)).toThrow();
  });
});
