import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("every product detail renders four persistent information tabs with safe missing states", async () => {
  const [detail, editor, schema] = await Promise.all([
    readFile("components/product/ProductDetailContent.tsx", "utf8"),
    readFile("components/admin-panel/NutritionEditor.tsx", "utf8"),
    readFile("lib/admin-product-schema.ts", "utf8"),
  ]);
  for (const id of ["description", "nutrition", "allergens", "ingredients"]) {
    assert.match(detail, new RegExp(`id: "${id}"`));
  }
  assert.match(detail, /allergensMissing/);
  assert.match(detail, /ingredientsMissing/);
  assert.match(detail, /nutritionMissing/);
  for (const key of ["ingredients", "allergens", "mayContainTraces"]) {
    assert.match(editor, new RegExp(`key: "${key}"`));
    assert.match(schema, new RegExp(`\\b${key}:`));
  }
});
