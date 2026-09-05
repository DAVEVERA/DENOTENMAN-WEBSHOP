import assert from "node:assert/strict";
import test from "node:test";
import { aftersalesTestSampleFilters } from "../lib/aftersales/test-sample";

test("an order-paid test email prefers a real order and falls back to a paid test order", () => {
  assert.deepEqual(aftersalesTestSampleFilters("ORDER_PAID"), [
    { businessOrderListId: null, isTest: false, status: { in: ["PAID", "FULFILLED"] } },
    { businessOrderListId: null, isTest: true, status: { in: ["PAID", "FULFILLED"] } },
  ]);
});

test("an order-fulfilled test email can use a paid test order when no fulfilled real order exists", () => {
  assert.deepEqual(aftersalesTestSampleFilters("ORDER_FULFILLED"), [
    { businessOrderListId: null, isTest: false, status: "FULFILLED" },
    { businessOrderListId: null, isTest: true, status: { in: ["PAID", "FULFILLED"] } },
  ]);
});

test("a business-order-paid test email only samples orders linked to a business order list", () => {
  assert.deepEqual(aftersalesTestSampleFilters("BUSINESS_ORDER_PAID"), [
    { businessOrderListId: { not: null }, isTest: false, status: { in: ["PAID", "FULFILLED"] } },
    { businessOrderListId: { not: null }, isTest: true, status: { in: ["PAID", "FULFILLED"] } },
  ]);
});

test("a business-order-fulfilled test email requires FULFILLED status for the real-order sample", () => {
  assert.deepEqual(aftersalesTestSampleFilters("BUSINESS_ORDER_FULFILLED"), [
    { businessOrderListId: { not: null }, isTest: false, status: "FULFILLED" },
    { businessOrderListId: { not: null }, isTest: true, status: { in: ["PAID", "FULFILLED"] } },
  ]);
});
