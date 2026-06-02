import assert from "node:assert/strict";
import test from "node:test";
import {
  mapMolliePaymentStatus,
  mapPaymentStatusToOrderStatus,
  shouldUpdatePaymentStatus,
} from "../../packages/mollie/src/payment-status-map";

test("mapMolliePaymentStatus normalizes Mollie statuses", () => {
  assert.equal(mapMolliePaymentStatus("paid"), "paid");
  assert.equal(mapMolliePaymentStatus("authorized"), "authorized");
  assert.equal(mapMolliePaymentStatus("canceled"), "cancelled");
  assert.equal(mapMolliePaymentStatus("expired"), "expired");
  assert.equal(mapMolliePaymentStatus("unknown-status"), "pending");
});

test("mapPaymentStatusToOrderStatus keeps unfinished payments pending", () => {
  assert.equal(mapPaymentStatusToOrderStatus("draft"), "pending");
  assert.equal(mapPaymentStatusToOrderStatus("open"), "pending");
  assert.equal(mapPaymentStatusToOrderStatus("pending"), "pending");
  assert.equal(mapPaymentStatusToOrderStatus("paid"), "paid");
  assert.equal(mapPaymentStatusToOrderStatus("authorized"), "paid");
  assert.equal(mapPaymentStatusToOrderStatus("failed"), "cancelled");
});

test("shouldUpdatePaymentStatus ignores duplicate and stale webhook statuses", () => {
  assert.equal(shouldUpdatePaymentStatus("draft", "open"), true);
  assert.equal(shouldUpdatePaymentStatus("open", "paid"), true);
  assert.equal(shouldUpdatePaymentStatus("paid", "paid"), false);
  assert.equal(shouldUpdatePaymentStatus("paid", "open"), false);
  assert.equal(shouldUpdatePaymentStatus("failed", "pending"), false);
});
