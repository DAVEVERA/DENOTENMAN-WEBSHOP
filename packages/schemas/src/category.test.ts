import { describe, it, expect } from "vitest";
import {
  CategoryTreeSchema,
  CategoryTreeChildSchema,
  CategoryDetailSchema,
  CategoryDetailChildSchema,
} from "./category.js";

const UUID_PARENT = "550e8400-e29b-41d4-a716-446655440010";
const UUID_CHILD = "550e8400-e29b-41d4-a716-446655440011";
const UUID_CHILD2 = "550e8400-e29b-41d4-a716-446655440012";

const validChild = {
  id: UUID_CHILD,
  slug: "hazelnoten",
  name: "Hazelnoten",
  description: null,
  parentId: UUID_PARENT,
  sortOrder: 0,
  productCount: 3,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  deletedAt: null,
};

const validTree = {
  id: UUID_PARENT,
  slug: "noten",
  name: "Noten",
  description: "Onze notencollectie",
  parentId: null,
  sortOrder: 0,
  productCount: 5,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  deletedAt: null,
  children: [validChild],
};

const validDetailChild = {
  id: UUID_CHILD2,
  slug: "cashewnoten",
  name: "Cashewnoten",
  description: null,
  parentId: UUID_PARENT,
  sortOrder: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  deletedAt: null,
};

const validDetail = {
  id: UUID_PARENT,
  slug: "noten",
  name: "Noten",
  description: "Onze notencollectie",
  parentId: null,
  sortOrder: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  deletedAt: null,
  parent: null,
  children: [validDetailChild],
};

describe("CategoryTreeChildSchema", () => {
  it("accepts a valid tree child", () => {
    const result = CategoryTreeChildSchema.parse(validChild);
    expect(result.slug).toBe("hazelnoten");
    expect(result.productCount).toBe(3);
  });

  it("rejects missing productCount", () => {
    const { productCount: _omitted, ...withoutCount } = validChild;
    expect(() => CategoryTreeChildSchema.parse(withoutCount)).toThrow();
  });

  it("rejects invalid slug", () => {
    expect(() => CategoryTreeChildSchema.parse({ ...validChild, slug: "Hazelnoten!" })).toThrow();
  });

  it("rejects negative productCount", () => {
    expect(() => CategoryTreeChildSchema.parse({ ...validChild, productCount: -1 })).toThrow();
  });

  it("strips unknown fields (e.g. _count from Prisma spread)", () => {
    const result = CategoryTreeChildSchema.parse({ ...validChild, _count: { products: 3 } });
    expect("_count" in result).toBe(false);
  });
});

describe("CategoryTreeSchema", () => {
  it("accepts a valid tree node with children", () => {
    const result = CategoryTreeSchema.parse(validTree);
    expect(result.id).toBe(UUID_PARENT);
    expect(result.children).toHaveLength(1);
    const firstChild = result.children[0];
    expect(firstChild?.slug).toBe("hazelnoten");
  });

  it("accepts a tree node with empty children array", () => {
    const result = CategoryTreeSchema.parse({ ...validTree, children: [] });
    expect(result.children).toHaveLength(0);
  });

  it("rejects missing required field (name)", () => {
    const { name: _omitted, ...withoutName } = validTree;
    expect(() => CategoryTreeSchema.parse(withoutName)).toThrow();
  });

  it("rejects missing children array", () => {
    const { children: _omitted, ...withoutChildren } = validTree;
    expect(() => CategoryTreeSchema.parse(withoutChildren)).toThrow();
  });

  it("rejects invalid uuid for id", () => {
    expect(() => CategoryTreeSchema.parse({ ...validTree, id: "not-a-uuid" })).toThrow();
  });

  it("coerces date strings to Date instances", () => {
    const result = CategoryTreeSchema.parse(validTree);
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.updatedAt).toBeInstanceOf(Date);
  });

  it("accepts null deletedAt", () => {
    const result = CategoryTreeSchema.parse(validTree);
    expect(result.deletedAt).toBeNull();
  });
});

describe("CategoryDetailChildSchema", () => {
  it("accepts a valid detail child", () => {
    const result = CategoryDetailChildSchema.parse(validDetailChild);
    expect(result.slug).toBe("cashewnoten");
  });

  it("rejects missing sortOrder", () => {
    const { sortOrder: _omitted, ...withoutSort } = validDetailChild;
    expect(() => CategoryDetailChildSchema.parse(withoutSort)).toThrow();
  });
});

describe("CategoryDetailSchema", () => {
  it("accepts a valid detail with null parent and children", () => {
    const result = CategoryDetailSchema.parse(validDetail);
    expect(result.slug).toBe("noten");
    expect(result.parent).toBeNull();
    expect(result.children).toHaveLength(1);
  });

  it("accepts a detail with a parent object", () => {
    const withParent = {
      ...validDetail,
      parentId: "550e8400-e29b-41d4-a716-446655440099",
      parent: {
        id: "550e8400-e29b-41d4-a716-446655440099",
        slug: "droogfruit",
        name: "Droogfruit",
      },
    };
    const result = CategoryDetailSchema.parse(withParent);
    expect(result.parent?.slug).toBe("droogfruit");
    expect(result.parent?.name).toBe("Droogfruit");
  });

  it("rejects missing parent field entirely", () => {
    const { parent: _omitted, ...withoutParent } = validDetail;
    expect(() => CategoryDetailSchema.parse(withoutParent)).toThrow();
  });

  it("rejects invalid slug in parent", () => {
    const withBadParent = {
      ...validDetail,
      parent: {
        id: "550e8400-e29b-41d4-a716-446655440099",
        slug: "Invalid Slug",
        name: "Ongeldig",
      },
    };
    expect(() => CategoryDetailSchema.parse(withBadParent)).toThrow();
  });

  it("rejects missing children array", () => {
    const { children: _omitted, ...withoutChildren } = validDetail;
    expect(() => CategoryDetailSchema.parse(withoutChildren)).toThrow();
  });

  it("accepts empty children array", () => {
    const result = CategoryDetailSchema.parse({ ...validDetail, children: [] });
    expect(result.children).toHaveLength(0);
  });
});
