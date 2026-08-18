import assert from "node:assert/strict";
import test from "node:test";
import {
  collectDescendantCategoryIds,
  validateCategoryParent,
} from "../lib/category-hierarchy";

const graph = [
  { id: "root", parentId: null },
  { id: "sub", parentId: "root" },
  { id: "leaf", parentId: "sub" },
  { id: "other", parentId: null },
];

test("collects a category and all descendants exactly once", () => {
  assert.deepEqual(collectDescendantCategoryIds("root", graph), ["root", "sub", "leaf"]);
});

test("rejects self-parenting, cycles and a fourth level", () => {
  assert.equal(validateCategoryParent("root", "root", graph), "SELF_PARENT");
  assert.equal(validateCategoryParent("root", "leaf", graph), "CATEGORY_CYCLE");
  assert.equal(validateCategoryParent("other", "leaf", graph), "CATEGORY_TOO_DEEP");
});

test("accepts a three-level hierarchy", () => {
  assert.equal(validateCategoryParent("leaf", "sub", graph), null);
});
