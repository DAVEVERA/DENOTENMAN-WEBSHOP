import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  IdSchema,
  SlugSchema,
  MoneyCentsSchema,
  PaginationQuerySchema,
  paginated,
} from "./common.js";

describe("IdSchema", () => {
  it("accepts a valid UUID", () => {
    expect(IdSchema.parse("550e8400-e29b-41d4-a716-446655440000")).toBe(
      "550e8400-e29b-41d4-a716-446655440000",
    );
  });

  it("rejects a non-UUID string", () => {
    expect(() => IdSchema.parse("not-a-uuid")).toThrow();
  });

  it("rejects a number", () => {
    expect(() => IdSchema.parse(123)).toThrow();
  });
});

describe("SlugSchema", () => {
  it("accepts a valid slug", () => {
    expect(SlugSchema.parse("hazelnoot-50g")).toBe("hazelnoot-50g");
  });

  it("accepts a single-word slug", () => {
    expect(SlugSchema.parse("noten")).toBe("noten");
  });

  it("rejects a slug with uppercase letters", () => {
    expect(() => SlugSchema.parse("Hazelnoot")).toThrow();
  });

  it("rejects a slug with leading hyphen", () => {
    expect(() => SlugSchema.parse("-noten")).toThrow();
  });

  it("rejects a slug with trailing hyphen", () => {
    expect(() => SlugSchema.parse("noten-")).toThrow();
  });

  it("rejects a slug with consecutive hyphens", () => {
    expect(() => SlugSchema.parse("noten--mix")).toThrow();
  });

  it("rejects a slug with spaces", () => {
    expect(() => SlugSchema.parse("noten mix")).toThrow();
  });
});

describe("MoneyCentsSchema", () => {
  it("accepts zero", () => {
    expect(MoneyCentsSchema.parse(0)).toBe(0);
  });

  it("accepts a positive integer", () => {
    expect(MoneyCentsSchema.parse(175)).toBe(175);
  });

  it("rejects a negative value", () => {
    expect(() => MoneyCentsSchema.parse(-1)).toThrow();
  });

  it("rejects a float", () => {
    expect(() => MoneyCentsSchema.parse(1.5)).toThrow();
  });

  it("rejects a string", () => {
    expect(() => MoneyCentsSchema.parse("175")).toThrow();
  });
});

describe("PaginationQuerySchema", () => {
  it("accepts valid page and pageSize", () => {
    const result = PaginationQuerySchema.parse({ page: 2, pageSize: 10 });
    expect(result).toEqual({ page: 2, pageSize: 10 });
  });

  it("applies defaults when empty object is provided", () => {
    const result = PaginationQuerySchema.parse({});
    expect(result).toEqual({ page: 1, pageSize: 20 });
  });

  it("coerces string numbers", () => {
    const result = PaginationQuerySchema.parse({ page: "3", pageSize: "5" });
    expect(result).toEqual({ page: 3, pageSize: 5 });
  });

  it("rejects pageSize above 100", () => {
    expect(() => PaginationQuerySchema.parse({ pageSize: 101 })).toThrow();
  });

  it("rejects page 0", () => {
    expect(() => PaginationQuerySchema.parse({ page: 0 })).toThrow();
  });
});

describe("paginated()", () => {
  const ItemSchema = z.object({ id: z.string() });

  it("wraps a schema correctly", () => {
    const PaginatedItem = paginated(ItemSchema);
    const result = PaginatedItem.parse({
      items: [{ id: "abc" }],
      page: 1,
      pageSize: 20,
      total: 1,
    });
    expect(result.items).toHaveLength(1);
    expect(result.page).toBe(1);
    expect(result.total).toBe(1);
  });

  it("rejects items that do not match the wrapped schema", () => {
    const PaginatedItem = paginated(ItemSchema);
    expect(() =>
      PaginatedItem.parse({
        items: [{ id: 123 }],
        page: 1,
        pageSize: 20,
        total: 1,
      }),
    ).toThrow();
  });

  it("rejects negative total", () => {
    const PaginatedItem = paginated(ItemSchema);
    expect(() =>
      PaginatedItem.parse({
        items: [],
        page: 1,
        pageSize: 20,
        total: -1,
      }),
    ).toThrow();
  });
});
