import assert from "node:assert/strict";
import test from "node:test";
import { aftersalesTriggerForOrderTransition } from "../lib/aftersales/events";

test("paid and fulfilled transitions map to one aftersales event", () => {
  assert.equal(aftersalesTriggerForOrderTransition("PENDING", "PAID", false), "ORDER_PAID");
  assert.equal(aftersalesTriggerForOrderTransition("PAID", "FULFILLED", false), "ORDER_FULFILLED");
});

test("unchanged, cancelled and test orders never trigger aftersales", () => {
  assert.equal(aftersalesTriggerForOrderTransition("PAID", "PAID", false), null);
  assert.equal(aftersalesTriggerForOrderTransition("PENDING", "CANCELLED", false), null);
  assert.equal(aftersalesTriggerForOrderTransition("PAID", "FULFILLED", true), null);
});
