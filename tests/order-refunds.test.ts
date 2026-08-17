import assert from "node:assert/strict";
import {
  calculateOrderRefund,
  OrderRefundCalculationError,
} from "../lib/order-refund-calculation";

const base = {
  subtotalCents: 10_000,
  discountCents: 1_000,
  shippingCents: 695,
  totalCents: 9_695,
  items: [
    { id: "almonds", quantity: 2, unitPriceCents: 2_500 },
    { id: "cashews", quantity: 1, unitPriceCents: 5_000 },
  ],
  existingRefunds: [],
};

assert.deepEqual(
  calculateOrderRefund({
    ...base,
    selections: [{ orderItemId: "almonds", quantity: 1 }],
    includeShipping: false,
  }),
  {
    amountCents: 2_250,
    selectedGrossCents: 2_500,
    allocatedDiscountCents: 250,
    remainingOrderCents: 9_695,
    items: [{ orderItemId: "almonds", quantity: 1, grossAmountCents: 2_500 }],
  }
);

const firstRefund = {
  status: "REFUNDED",
  amountCents: 2_250,
  includesShipping: false,
  items: [{ orderItemId: "almonds", quantity: 1, grossAmountCents: 2_500 }],
};
const finalRefund = calculateOrderRefund({
  ...base,
  existingRefunds: [firstRefund],
  selections: [
    { orderItemId: "almonds", quantity: 1 },
    { orderItemId: "cashews", quantity: 1 },
  ],
  includeShipping: true,
});
assert.equal(finalRefund.amountCents, 7_445);
assert.equal(firstRefund.amountCents + finalRefund.amountCents, base.totalCents);

assert.throws(
  () =>
    calculateOrderRefund({
      ...base,
      existingRefunds: [firstRefund],
      selections: [{ orderItemId: "almonds", quantity: 2 }],
      includeShipping: false,
    }),
  (error: unknown) =>
    error instanceof OrderRefundCalculationError &&
    error.code === "REFUND_QUANTITY_EXCEEDS_REMAINING"
);

assert.throws(
  () =>
    calculateOrderRefund({
      ...base,
      existingRefunds: [{ ...firstRefund, includesShipping: true }],
      selections: [{ orderItemId: "cashews", quantity: 1 }],
      includeShipping: true,
    }),
  (error: unknown) =>
    error instanceof OrderRefundCalculationError && error.code === "SHIPPING_ALREADY_REFUNDED"
);

console.log("order refund calculation tests passed");
