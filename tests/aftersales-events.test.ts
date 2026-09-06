import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

test("paid business orders process queued aftersales immediately and on retry", async () => {
  const orders = await readFile("lib/orders.ts", "utf8");
  const paidDispatch = orders.slice(
    orders.indexOf('if (transition.count === 1 && nextStatus === "PAID")'),
    orders.indexOf("return transition.updated;"),
  );
  const alreadyPaidRetry = orders.slice(
    orders.indexOf('if (order.status === "PAID" || order.status === "FULFILLED")'),
    orders.indexOf("// The order status remains the source of truth."),
  );

  assert.match(paidDispatch, /if \(transition\.queued\)[\s\S]*processAftersalesDelivery/);
  assert.match(paidDispatch, /isBusinessOrder[\s\S]*generateAndSendBusinessInvoice/);
  assert.match(alreadyPaidRetry, /if \(!order\.isTest\)[\s\S]*processPendingAftersalesForOrder/);
  assert.doesNotMatch(alreadyPaidRetry, /if \(!order\.isTest && !order\.businessOrderListId\)/);
});
