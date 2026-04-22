import { describe, it, expect } from "vitest";
import {
  ProductSchema,
  ProductCreateSchema,
  ProductUpdateSchema,
  ProductVariantSchema,
  ProductImageSchema,
  CategorySchema,
  TagSchema,
} from "./product.js";

const validCategory = {
  id: "550e8400-e29b-41d4-a716-446655440001",
  slug: "noten",
  name: "Noten",
  description: null,
  parentId: null,
  sortOrder: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  deletedAt: null,
};

const validVariant = {
  id: "550e8400-e29b-41d4-a716-446655440002",
  productId: "550e8400-e29b-41d4-a716-446655440000",
  sku: "HAZ-50G",
  name: "50g",
  weightGrams: 50,
  priceCents: 175,
  currency: "EUR",
  stockQuantity: 10,
  lowStockAt: 5,
  position: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  deletedAt: null,
};

const validImage = {
  id: "550e8400-e29b-41d4-a716-446655440003",
  productId: "550e8400-e29b-41d4-a716-446655440000",
  url: "https://example.com/img.jpg",
  altText: "Hazelnoot",
  position: 0,
  width: null,
  height: null,
  createdAt: new Date().toISOString(),
};

const validTag = {
  id: "550e8400-e29b-41d4-a716-446655440004",
  slug: "biologisch",
  name: "Biologisch",
  createdAt: new Date().toISOString(),
};

const validProduct = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  sku: "HAZ-001",
  slug: "hazelnoot",
  name: "Hazelnoot",
  description: null,
  categoryId: "550e8400-e29b-41d4-a716-446655440001",
  status: "active" as const,
  origin: "Turkije",
  harvestYear: 2024,
  roasted: false,
  organic: true,
  allergens: ["noten"],
  ingredients: null,
  storageInfo: null,
  tasteNotes: null,
  usageTip: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  deletedAt: null,
  variants: [validVariant],
  images: [validImage],
  tags: [validTag],
  category: validCategory,
};

describe("CategorySchema", () => {
  it("accepts valid category", () => {
    const result = CategorySchema.parse(validCategory);
    expect(result.id).toBe(validCategory.id);
  });

  it("rejects invalid uuid for id", () => {
    expect(() => CategorySchema.parse({ ...validCategory, id: "bad-id" })).toThrow();
  });

  it("rejects invalid slug", () => {
    expect(() => CategorySchema.parse({ ...validCategory, slug: "Bad Slug!" })).toThrow();
  });
});

describe("TagSchema", () => {
  it("accepts valid tag", () => {
    const result = TagSchema.parse(validTag);
    expect(result.slug).toBe("biologisch");
  });
});

describe("ProductVariantSchema", () => {
  it("accepts valid variant", () => {
    const result = ProductVariantSchema.parse(validVariant);
    expect(result.priceCents).toBe(175);
  });

  it("rejects negative priceCents", () => {
    expect(() => ProductVariantSchema.parse({ ...validVariant, priceCents: -1 })).toThrow();
  });

  it("rejects float priceCents", () => {
    expect(() => ProductVariantSchema.parse({ ...validVariant, priceCents: 1.5 })).toThrow();
  });
});

describe("ProductImageSchema", () => {
  it("accepts valid image", () => {
    const result = ProductImageSchema.parse(validImage);
    expect(result.url).toBe("https://example.com/img.jpg");
  });

  it("rejects invalid url", () => {
    expect(() => ProductImageSchema.parse({ ...validImage, url: "not-a-url" })).toThrow();
  });
});

describe("ProductSchema", () => {
  it("accepts valid product", () => {
    const result = ProductSchema.parse(validProduct);
    expect(result.slug).toBe("hazelnoot");
    expect(result.deletedAt).toBeNull();
  });

  it("accepts product with deletedAt set", () => {
    const result = ProductSchema.parse({
      ...validProduct,
      deletedAt: new Date().toISOString(),
    });
    expect(result.deletedAt).toBeInstanceOf(Date);
  });

  it("rejects invalid status", () => {
    expect(() => ProductSchema.parse({ ...validProduct, status: "unknown" })).toThrow();
  });

  it("rejects invalid slug", () => {
    expect(() => ProductSchema.parse({ ...validProduct, slug: "Bad Slug" })).toThrow();
  });
});

describe("ProductCreateSchema", () => {
  it("accepts the required create fields", () => {
    const input = {
      sku: "HAZ-001",
      slug: "hazelnoot",
      name: "Hazelnoot",
      description: null,
      categoryId: "550e8400-e29b-41d4-a716-446655440001",
      status: "draft" as const,
      origin: null,
      harvestYear: null,
      roasted: null,
      organic: false,
      allergens: [],
      ingredients: null,
      storageInfo: null,
      tasteNotes: null,
      usageTip: null,
    };
    const result = ProductCreateSchema.parse(input);
    expect(result.sku).toBe("HAZ-001");
  });

  it("does not have variants/images/tags/category fields", () => {
    const schema = ProductCreateSchema;
    expect("variants" in schema.shape).toBe(false);
    expect("images" in schema.shape).toBe(false);
  });
});

describe("ProductUpdateSchema", () => {
  it("allows all fields to be omitted (full partial)", () => {
    const result = ProductUpdateSchema.parse({});
    expect(result).toEqual({});
  });

  it("accepts a subset of fields", () => {
    const result = ProductUpdateSchema.parse({ name: "Updated" });
    expect(result.name).toBe("Updated");
  });

  it("still rejects invalid slug when provided", () => {
    expect(() => ProductUpdateSchema.parse({ slug: "Bad Slug!!" })).toThrow();
  });
});
