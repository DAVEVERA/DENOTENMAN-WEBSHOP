import assert from "node:assert/strict";
import test from "node:test";
import {
  isAllowedAdminOrderTransition,
  requiresTrackingForFulfillment,
} from "../lib/aftersales/order-state";

test("admin statusovergangen volgen de bestel-state-machine", () => {
  assert.equal(isAllowedAdminOrderTransition("PENDING", "CANCELLED"), true);
  assert.equal(isAllowedAdminOrderTransition("PAID", "FULFILLED"), true);
  assert.equal(isAllowedAdminOrderTransition("PAID", "CANCELLED"), false);
  assert.equal(isAllowedAdminOrderTransition("PENDING", "FULFILLED"), false);
  assert.equal(isAllowedAdminOrderTransition("FULFILLED", "PAID"), false);
  assert.equal(isAllowedAdminOrderTransition("REFUNDED", "FULFILLED"), false);
});

test("alleen verzending vereist tracking bij fulfilment", () => {
  assert.equal(requiresTrackingForFulfillment("SHIPPING"), true);
  assert.equal(requiresTrackingForFulfillment("PICKUP"), false);
});
