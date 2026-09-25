import assert from "node:assert/strict";
import test from "node:test";
import { getOrderRefundBadgeState } from "../lib/order-refund-badge";

test("no refunds means no badge", () => {
  assert.equal(getOrderRefundBadgeState(9_695, []), "NONE");
});

test("a committed refund below the order total is a partial refund", () => {
  assert.equal(
    getOrderRefundBadgeState(9_695, [{ amountCents: 2_250, status: "REFUNDED" }]),
    "PARTIAL"
  );
});

test("committed refunds summing to the full order total count as a full refund", () => {
  assert.equal(
    getOrderRefundBadgeState(9_695, [
      { amountCents: 2_250, status: "REFUNDED" },
      { amountCents: 7_445, status: "PROCESSING" },
    ]),
    "FULL"
  );
});

test("a failed or canceled refund attempt does not count towards the refunded amount", () => {
  assert.equal(
    getOrderRefundBadgeState(9_695, [{ amountCents: 9_695, status: "FAILED" }]),
    "NONE"
  );
  assert.equal(
    getOrderRefundBadgeState(9_695, [{ amountCents: 9_695, status: "CANCELED" }]),
    "NONE"
  );
});

test("an order status that hasn't synced to REFUNDED yet still shows as fully refunded once the amounts match", () => {
  // This is the whole point of deriving the badge from OrderRefund rows
  // instead of Order.status: a refund can be committed with the Mollie
  // webhook lag still in flight.
  assert.equal(
    getOrderRefundBadgeState(1_000, [{ amountCents: 1_000, status: "PROCESSING" }]),
    "FULL"
  );
});
