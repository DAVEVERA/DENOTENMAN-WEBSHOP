import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMollieOrderReference,
  orderLookupWhere,
  publicOrderNumber,
} from "../lib/order-reference";

test("new orders use the public DN number in customer-facing references", () => {
  const order = { id: "cmuig0bp2000ks601zji9xf35", orderNumber: "DN-2026-00125" };

  assert.equal(publicOrderNumber(order), "DN-2026-00125");
  assert.deepEqual(buildMollieOrderReference(order), {
    description: "Bestelling DN-2026-00125 - De Notenman",
    metadata: {
      orderId: "cmuig0bp2000ks601zji9xf35",
      orderNumber: "DN-2026-00125",
    },
  });
});

test("legacy orders without a public number keep their internal ID as fallback", () => {
  const order = { id: "legacy-order-id", orderNumber: null };

  assert.equal(publicOrderNumber(order), "legacy-order-id");
  assert.deepEqual(buildMollieOrderReference(order), {
    description: "Bestelling legacy-order-id - De Notenman",
    metadata: {
      orderId: "legacy-order-id",
      orderNumber: "legacy-order-id",
    },
  });
});

test("order lookup accepts both a public number and a legacy internal ID", () => {
  assert.deepEqual(orderLookupWhere(" DN-2026-00125 "), {
    OR: [{ orderNumber: "DN-2026-00125" }, { id: "DN-2026-00125" }],
  });
  assert.deepEqual(orderLookupWhere("legacy-order-id"), {
    OR: [{ orderNumber: "legacy-order-id" }, { id: "legacy-order-id" }],
  });
});
