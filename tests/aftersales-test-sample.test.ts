import assert from "node:assert/strict";
import test from "node:test";
import { aftersalesTestSampleFilters } from "../lib/aftersales/test-sample";

test("an order-paid test email prefers a real order and falls back to a paid test order", () => {
  assert.deepEqual(aftersalesTestSampleFilters("ORDER_PAID"), [
    { isTest: false, status: { in: ["PAID", "FULFILLED"] } },
    { isTest: true, status: { in: ["PAID", "FULFILLED"] } },
  ]);
});

test("an order-fulfilled test email can use a paid test order when no fulfilled real order exists", () => {
  assert.deepEqual(aftersalesTestSampleFilters("ORDER_FULFILLED"), [
    { isTest: false, status: "FULFILLED" },
    { isTest: true, status: { in: ["PAID", "FULFILLED"] } },
  ]);
});
