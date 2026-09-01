import assert from "node:assert/strict";
import test from "node:test";
import type { Order, OrderItem } from "@prisma/client";
import { sendCompletedTestOrderConfirmation } from "../lib/test-order-confirmation";

const testOrder = {
  id: "test-order-1",
  userId: "test-user-1",
  status: "PAID",
  isTest: true,
  locale: "nl",
  currency: "EUR",
  subtotalCents: 1200,
  discountCode: "TEST-CODE",
  discountCents: 1200,
  shippingCents: 0,
  totalCents: 0,
  contactName: "Testklant",
  contactEmail: "test@example.com",
  contactPhone: null,
  deliveryMethod: "SHIPPING",
  pickupLocationId: null,
  shippingStreet: "Teststraat",
  shippingHouseNumber: "1",
  shippingPostalCode: "1234AB",
  shippingCity: "Teststad",
  shippingCountry: "NL",
  molliePaymentId: null,
  businessOrderListId: null,
  paidAt: new Date("2026-08-21T13:15:57.797Z"),
  postnlTrackingCode: null,
  postnlLabelBase64: null,
  postnlLabelClaimToken: null,
  postnlLabelClaimedAt: null,
  postnlLabelLastError: null,
  createdAt: new Date("2026-08-21T13:15:57.798Z"),
  updatedAt: new Date("2026-08-21T13:15:57.798Z"),
  items: [
    {
      id: "test-item-1",
      orderId: "test-order-1",
      variantId: "test-variant-1",
      sku: null,
      productName: "Testproduct",
      variantLabel: "250 gram",
      quantity: 2,
      unitPriceCents: 600,
    },
  ],
} satisfies Order & { items: OrderItem[] };

test("a completed zero-euro test order sends its order confirmation", async () => {
  let delivered: { orderId: string; itemCount: number } | null = null;

  await sendCompletedTestOrderConfirmation(testOrder, async (order, items) => {
    delivered = { orderId: order.id, itemCount: items.length };
  });

  assert.deepEqual(delivered, { orderId: "test-order-1", itemCount: 1 });
});

test("a provider failure does not turn a completed test order into a failed checkout", async () => {
  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    await assert.doesNotReject(() =>
      sendCompletedTestOrderConfirmation(testOrder, async () => {
        throw new Error("provider unavailable");
      })
    );
  } finally {
    console.error = originalConsoleError;
  }
});
