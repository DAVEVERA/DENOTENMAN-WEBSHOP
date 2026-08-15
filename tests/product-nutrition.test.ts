import assert from "node:assert/strict";
import test from "node:test";
import { formatNutritionMeasurement } from "../components/product/ProductDetailContent";

test("storefront nutrition values display an explicit gram unit", () => {
  assert.equal(formatNutritionMeasurement("52"), "52 g");
  assert.equal(formatNutritionMeasurement("0,01"), "0,01 g");
});
