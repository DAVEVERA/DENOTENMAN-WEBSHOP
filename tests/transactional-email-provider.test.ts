import assert from "node:assert/strict";
import test from "node:test";
import { EmailDeliveryKind } from "@prisma/client";
import {
  aftersalesProviderStatus,
  checkTransactionalProviderReadiness,
  sendAftersalesMail,
  TransactionalProviderError,
} from "../lib/aftersales/provider";
import {
  normalizeRecipientEmail,
  requiresCurrentOrderRecipient,
} from "../lib/transactional-email";

const originalFetch = global.fetch;
const originalTransactionalKey = process.env.MAILCHIMP_TRANSACTIONAL_API_KEY;
const originalMarketingKey = process.env.MAILCHIMP_API_KEY;
const originalResendKey = process.env.RESEND_API_KEY;

function restoreEnvironment() {
  global.fetch = originalFetch;
  if (originalTransactionalKey === undefined) delete process.env.MAILCHIMP_TRANSACTIONAL_API_KEY;
  else process.env.MAILCHIMP_TRANSACTIONAL_API_KEY = originalTransactionalKey;
  if (originalMarketingKey === undefined) delete process.env.MAILCHIMP_API_KEY;
  else process.env.MAILCHIMP_API_KEY = originalMarketingKey;
  if (originalResendKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = originalResendKey;
}

test.afterEach(restoreEnvironment);

test("does not treat a Mailchimp Marketing key as a Transactional key", () => {
  process.env.MAILCHIMP_API_KEY = "marketing-key";
  delete process.env.MAILCHIMP_TRANSACTIONAL_API_KEY;
  delete process.env.RESEND_API_KEY;

  assert.equal(aftersalesProviderStatus().provider, "none");
  assert.match(aftersalesProviderStatus().detail, /MAILCHIMP_TRANSACTIONAL_API_KEY/);
});

test("normalizes recipients and enforces the current order recipient for order mail", () => {
  assert.equal(normalizeRecipientEmail("  Klant@Example.COM "), "klant@example.com");
  assert.equal(requiresCurrentOrderRecipient(EmailDeliveryKind.ORDER_CONFIRMATION), true);
  assert.equal(requiresCurrentOrderRecipient(EmailDeliveryKind.ORDER_FULFILLED), true);
  assert.equal(requiresCurrentOrderRecipient(EmailDeliveryKind.AFTERSALES_TEST), false);
});

test("accepts only the Mailchimp result for the requested recipient", async () => {
  process.env.MAILCHIMP_TRANSACTIONAL_API_KEY = "transactional-key";
  global.fetch = async (_input, init) => {
    const request = JSON.parse(String(init?.body)) as { message: { to: Array<{ email: string }> } };
    assert.equal(request.message.to.length, 1);
    assert.equal(request.message.to[0]?.email, "klant@example.com");
    return Response.json([{ email: "klant@example.com", status: "sent", _id: "provider-123" }]);
  };

  const result = await sendAftersalesMail({
    deliveryId: "delivery-123",
    orderId: "order-123",
    trigger: "ORDER_PAID",
    to: "klant@example.com",
    subject: "Bevestiging",
    html: "<p>Bevestiging</p>",
    text: "Bevestiging",
  });

  assert.deepEqual(result, {
    provider: "MAILCHIMP_TRANSACTIONAL",
    messageId: "provider-123",
    providerStatus: "sent",
  });
});

test("rejects a provider response for a different recipient", async () => {
  process.env.MAILCHIMP_TRANSACTIONAL_API_KEY = "transactional-key";
  global.fetch = async () => Response.json([
    { email: "ander@example.com", status: "sent", _id: "provider-456" },
  ]);

  await assert.rejects(
    () => sendAftersalesMail({
      deliveryId: "delivery-456",
      orderId: "order-456",
      trigger: "ORDER_PAID",
      to: "klant@example.com",
      subject: "Bevestiging",
      html: "<p>Bevestiging</p>",
      text: "Bevestiging",
    }),
    (error: unknown) => error instanceof TransactionalProviderError && error.code === "RECIPIENT_MISMATCH"
  );
});

test("marks Resend as not ready when the sender domain is not verified", async () => {
  delete process.env.MAILCHIMP_TRANSACTIONAL_API_KEY;
  process.env.RESEND_API_KEY = "resend-key";
  global.fetch = async () => Response.json({ data: [] });

  const readiness = await checkTransactionalProviderReadiness();
  assert.equal(readiness.ready, false);
  assert.equal(readiness.provider, "resend");
  assert.match(readiness.message, /denotenman\.com/);
});
