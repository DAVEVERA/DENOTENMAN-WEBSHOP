import assert from "node:assert/strict";
import test from "node:test";
import { aftersalesTriggerForOrderTransition } from "../lib/aftersales/events";

test("paid and fulfilled transitions map to the particuliere aftersales events", () => {
  assert.equal(aftersalesTriggerForOrderTransition("PENDING", "PAID", false, false), "ORDER_PAID");
  assert.equal(aftersalesTriggerForOrderTransition("PAID", "FULFILLED", false, false), "ORDER_FULFILLED");
});

test("paid and fulfilled transitions map to the zakelijke aftersales events for business orders", () => {
  assert.equal(aftersalesTriggerForOrderTransition("PENDING", "PAID", false, true), "BUSINESS_ORDER_PAID");
  assert.equal(aftersalesTriggerForOrderTransition("PAID", "FULFILLED", false, true), "BUSINESS_ORDER_FULFILLED");
});

test("unchanged, cancelled and test orders never trigger aftersales, business or not", () => {
  assert.equal(aftersalesTriggerForOrderTransition("PAID", "PAID", false, false), null);
  assert.equal(aftersalesTriggerForOrderTransition("PENDING", "CANCELLED", false, false), null);
  assert.equal(aftersalesTriggerForOrderTransition("PAID", "FULFILLED", true, false), null);
  assert.equal(aftersalesTriggerForOrderTransition("PAID", "FULFILLED", true, true), null);
});
