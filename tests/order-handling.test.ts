import assert from "node:assert/strict";
import test from "node:test";

import { applyHandling, describeHandled, handlingWhere, isHandleable, parseHandlingFilter, type HandlingOrder } from "../lib/order-handling";

const now = new Date("2026-10-07T10:00:00Z");
const earlier = new Date("2026-10-06T08:00:00Z");
const order = (extra: Partial<HandlingOrder> = {}): HandlingOrder => ({ status: "PAID", isTest: false, deliveryMethod: "SHIPPING", processedAt: null, readyForPickupAt: null, ...extra });

test("only paid or shipped non-test orders can be handled", () => {
  assert.equal(isHandleable(order()), true);
  assert.equal(isHandleable(order({ status: "FULFILLED" })), true);
  for (const status of ["PENDING", "CANCELLED", "REFUNDED"]) assert.equal(isHandleable(order({ status })), false, status);
  assert.equal(isHandleable(order({ isTest: true })), false);
  assert.deepEqual(applyHandling(order({ status: "PENDING" }), { processed: true }, "Fedor", now), { ok: false, error: "NOT_HANDLEABLE" });
});

test("ticking verwerkt stores who and when; unticking clears both", () => {
  assert.deepEqual(applyHandling(order(), { processed: true }, "Fedor", now), { ok: true, data: { processedAt: now, processedByName: "Fedor" } });
  assert.deepEqual(applyHandling(order({ processedAt: now }), { processed: false }, "Fedor", now), { ok: true, data: { processedAt: null, processedByName: null } });
});

test("ticking something already ticked keeps the first person and time", () => {
  assert.deepEqual(applyHandling(order({ processedAt: earlier }), { processed: true }, "Anna", now), { ok: true, data: {} });
});

test("staat klaar is only for pickup orders", () => {
  assert.deepEqual(applyHandling(order(), { readyForPickup: true }, "Fedor", now), { ok: false, error: "NOT_A_PICKUP" });
  const pickup = order({ deliveryMethod: "PICKUP" });
  assert.deepEqual(applyHandling(pickup, { readyForPickup: true }, "Fedor", now), { ok: true, data: { readyForPickupAt: now, readyForPickupByName: "Fedor" } });
  assert.deepEqual(applyHandling(order({ deliveryMethod: "PICKUP", readyForPickupAt: now }), { readyForPickup: false }, "Fedor", now), { ok: true, data: { readyForPickupAt: null, readyForPickupByName: null } });
  assert.deepEqual(applyHandling(pickup, { processed: true, readyForPickup: true }, "Fedor", now), { ok: true, data: { processedAt: now, processedByName: "Fedor", readyForPickupAt: now, readyForPickupByName: "Fedor" } });
});

test("an empty request is refused", () => {
  assert.deepEqual(applyHandling(order(), {}, "Fedor", now), { ok: false, error: "NO_FIELDS" });
});

test("list filters only look at paid non-test orders", () => {
  assert.equal(parseHandlingFilter("verwerkt"), "verwerkt");
  assert.equal(parseHandlingFilter("zomaar"), null);
  assert.deepEqual(handlingWhere("te-verwerken"), { isTest: false, status: { in: ["PAID", "FULFILLED"] }, processedAt: null });
  assert.equal(handlingWhere("staat-klaar").deliveryMethod, "PICKUP");
  assert.equal(handlingWhere("klaar-te-zetten").readyForPickupAt, null);
});

test("who and when is shown, and old shipped orders say automatisch", () => {
  const format = () => "07-10 10:00";
  assert.equal(describeHandled(now, "Fedor", format), "Fedor, 07-10 10:00");
  assert.equal(describeHandled(now, null, format), "automatisch, 07-10 10:00");
  assert.equal(describeHandled(null, null, format), null);
});
