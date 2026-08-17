import assert from "node:assert/strict";
import type { Order } from "@prisma/client";
import { renderOrderConfirmationEmail } from "../lib/mail";

function baseOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "order-1",
    userId: "user-1",
    status: "PAID",
    isTest: false,
    locale: "nl",
    currency: "EUR",
    subtotalCents: 500,
    discountCode: null,
    discountCents: 0,
    shippingCents: 495,
    totalCents: 995,
    contactName: "Jan Jansen",
    contactEmail: "jan@example.com",
    contactPhone: null,
    deliveryMethod: "SHIPPING",
    pickupLocationId: null,
    shippingStreet: "Kerkstraat",
    shippingHouseNumber: "1",
    shippingPostalCode: "5405 AB",
    shippingCity: "Uden",
    shippingCountry: "NL",
    molliePaymentId: null,
    paidAt: new Date("2026-08-17T10:00:00.000Z"),
    postnlTrackingCode: null,
    postnlLabelBase64: null,
    createdAt: new Date("2026-08-17T09:00:00.000Z"),
    updatedAt: new Date("2026-08-17T09:00:00.000Z"),
    ...overrides,
  };
}

async function main() {
  // Shipping orders keep showing the postal address.
  const shippingEmail = await renderOrderConfirmationEmail(baseOrder(), []);
  assert.ok(shippingEmail.text.includes("Kerkstraat 1"));
  assert.ok(shippingEmail.text.includes("5405 AB Uden"));
  assert.ok(!shippingEmail.text.includes("null"));

  // Pickup orders must never render the null address fields, and should
  // name the pickup location instead.
  const pickupEmail = await renderOrderConfirmationEmail(
    baseOrder({
      deliveryMethod: "PICKUP",
      pickupLocationId: "uden",
      shippingStreet: null,
      shippingHouseNumber: null,
      shippingPostalCode: null,
      shippingCity: null,
      shippingCents: 0,
      totalCents: 500,
    }),
    []
  );
  assert.ok(!pickupEmail.text.includes("null"));
  assert.ok(pickupEmail.text.includes("Uden"));
  assert.ok(pickupEmail.text.includes("Afhalen op de markt"));

  console.log("mail order confirmation tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
