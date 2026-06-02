import assert from "node:assert/strict";
import test from "node:test";
import { getAvailableStock, hasStock } from "../../packages/commerce/src/inventory/check-stock";
import { reserveStock } from "../../packages/commerce/src/inventory/reserve-stock";

test("reserveStock reduces available stock through reservations", () => {
  const item = reserveStock({ sku: "TEST", available: 10 }, 4);

  assert.equal(item.reserved, 4);
  assert.equal(getAvailableStock(item), 6);
  assert.equal(hasStock(item, 7), false);
});
