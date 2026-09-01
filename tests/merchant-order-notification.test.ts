import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  isMerchantNewOrderNotifiable,
  merchantOrderNotificationRecipient,
} from "../lib/merchant-order-notification";

test("only a paid real order qualifies for Fedor's one-time notification", () => {
  assert.equal(isMerchantNewOrderNotifiable({ status: "PENDING", isTest: false }), false);
  assert.equal(isMerchantNewOrderNotifiable({ status: "CANCELLED", isTest: false }), false);
  assert.equal(isMerchantNewOrderNotifiable({ status: "PAID", isTest: false }), true);
  assert.equal(isMerchantNewOrderNotifiable({ status: "FULFILLED", isTest: false }), true);
  assert.equal(isMerchantNewOrderNotifiable({ status: "PAID", isTest: true }), false);
});

test("the notification recipient is configurable and otherwise uses the public business inbox", () => {
  const original = process.env.ORDER_NOTIFICATION_EMAIL;
  try {
    process.env.ORDER_NOTIFICATION_EMAIL = " fedor@example.com ";
    assert.equal(merchantOrderNotificationRecipient(), "fedor@example.com");
    delete process.env.ORDER_NOTIFICATION_EMAIL;
    assert.equal(merchantOrderNotificationRecipient(), "info@denotenman.com");
  } finally {
    if (original === undefined) delete process.env.ORDER_NOTIFICATION_EMAIL;
    else process.env.ORDER_NOTIFICATION_EMAIL = original;
  }
});

test("the internal email is clear, mobile-safe and links to the order in admin", () => {
  const template = readFileSync(
    new URL("../emails/NewOrderNotificationEmail.tsx", import.meta.url),
    "utf8",
  );
  const service = readFileSync(
    new URL("../lib/merchant-order-notification.ts", import.meta.url),
    "utf8",
  );

  assert.match(template, /Nieuwe bestelling geplaatst/);
  assert.match(template, /betaling is bevestigd/i);
  assert.match(template, /Open bestelling in admin/);
  assert.match(template, /geen extra interne e-mail/i);
  assert.match(template, /fontSize: "16px"/);
  assert.match(template, /padding: "14px 20px"/);
  assert.match(service, /\/admin\/bestellingen\/\$\{order\.id\}/);
});

test("Fedor's notification is only wired to the authoritative paid-order sync", () => {
  const orders = readFileSync(new URL("../lib/orders.ts", import.meta.url), "utf8");
  const aftersales = readFileSync(new URL("../lib/aftersales/service.ts", import.meta.url), "utf8");
  const adminOrder = readFileSync(
    new URL("../app/api/admin/orders/[id]/route.ts", import.meta.url),
    "utf8",
  );
  const service = readFileSync(
    new URL("../lib/merchant-order-notification.ts", import.meta.url),
    "utf8",
  );

  assert.match(orders, /syncOrderPaymentStatus[\s\S]*sendMerchantNewOrderNotification/);
  assert.match(service, /merchant-new-order-\$\{orderId\}/);
  assert.match(service, /status === "PAID" \|\| input\.status === "FULFILLED"/);
  assert.doesNotMatch(aftersales, /sendMerchantNewOrderNotification/);
  assert.doesNotMatch(adminOrder, /sendMerchantNewOrderNotification/);
});
