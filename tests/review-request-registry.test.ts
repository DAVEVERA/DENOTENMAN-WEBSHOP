import assert from "node:assert/strict";
import test from "node:test";
import {
  PARTICULIER_TRIGGERS,
  AFTERSALES_TOKENS_BY_TRIGGER,
  AFTERSALES_TRIGGERS_BY_FLOW_TYPE,
} from "../lib/aftersales/schema";
import { aftersalesTriggerForOrderTransition } from "../lib/aftersales/events";

test("review request is a particuliere trigger with order tokens", () => {
  assert.ok((PARTICULIER_TRIGGERS as readonly string[]).includes("REVIEW_REQUEST"));
  assert.ok(AFTERSALES_TOKENS_BY_TRIGGER.REVIEW_REQUEST.includes("first_name"));
  assert.ok(AFTERSALES_TOKENS_BY_TRIGGER.REVIEW_REQUEST.includes("order_number"));
});

test("review request carries no tracking token", () => {
  assert.ok(!AFTERSALES_TOKENS_BY_TRIGGER.REVIEW_REQUEST.includes("tracking_code"));
});

test("review request is never fired by an order status transition", () => {
  const transitions = [
    ["PENDING", "PAID"],
    ["PAID", "FULFILLED"],
    ["PAID", "REFUNDED"],
  ] as const;
  for (const [from, to] of transitions) {
    assert.notEqual(aftersalesTriggerForOrderTransition(from, to, false, false), "REVIEW_REQUEST");
    assert.notEqual(aftersalesTriggerForOrderTransition(from, to, false, true), "REVIEW_REQUEST");
  }
});

test("review request is not offered on the zakelijke flow", () => {
  assert.ok(!(AFTERSALES_TRIGGERS_BY_FLOW_TYPE.ZAKELIJK as readonly string[]).includes("REVIEW_REQUEST"));
});
