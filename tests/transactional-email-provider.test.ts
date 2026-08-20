import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
const originalMailFromEmail = process.env.MAIL_FROM_EMAIL;
const originalMailFromAddress = process.env.MAIL_FROM_ADDRESS;
const originalNodeTlsRejectUnauthorized = process.env.NODE_TLS_REJECT_UNAUTHORIZED;

function restoreEnvironment() {
  global.fetch = originalFetch;
  if (originalTransactionalKey === undefined) delete process.env.MAILCHIMP_TRANSACTIONAL_API_KEY;
  else process.env.MAILCHIMP_TRANSACTIONAL_API_KEY = originalTransactionalKey;
  if (originalMarketingKey === undefined) delete process.env.MAILCHIMP_API_KEY;
  else process.env.MAILCHIMP_API_KEY = originalMarketingKey;
  if (originalResendKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = originalResendKey;
  if (originalMailFromEmail === undefined) delete process.env.MAIL_FROM_EMAIL;
  else process.env.MAIL_FROM_EMAIL = originalMailFromEmail;
  if (originalMailFromAddress === undefined) delete process.env.MAIL_FROM_ADDRESS;
  else process.env.MAIL_FROM_ADDRESS = originalMailFromAddress;
  if (originalNodeTlsRejectUnauthorized === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  else process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalNodeTlsRejectUnauthorized;
}

test.beforeEach(() => {
  process.env.MAIL_FROM_EMAIL = "bestellingen@denotenman.com";
  delete process.env.MAIL_FROM_ADDRESS;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "1";
});

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
  delete process.env.MAIL_FROM_EMAIL;
  process.env.MAIL_FROM_ADDRESS = "De Notenman <transactioneel@denotenman.com>";
  global.fetch = async (_input, init) => {
    const request = JSON.parse(String(init?.body)) as { message: { from_email: string; to: Array<{ email: string }> } };
    assert.equal(request.message.from_email, "transactioneel@denotenman.com");
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

test("fails closed before provider access when TLS verification is disabled", async () => {
  process.env.MAILCHIMP_TRANSACTIONAL_API_KEY = "transactional-key";
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  global.fetch = async () => {
    throw new Error("fetch should not be called");
  };

  const readiness = await checkTransactionalProviderReadiness();
  assert.equal(readiness.ready, false);
  assert.equal(readiness.reason, "insecure_tls");
  assert.match(readiness.message, /TLS-certificaatcontrole/);
});

test("does not mark a Mailchimp demo account as production ready", async () => {
  process.env.MAILCHIMP_TRANSACTIONAL_API_KEY = "transactional-key";
  delete process.env.RESEND_API_KEY;
  global.fetch = async (input) => {
    assert.match(String(input), /users\/info/);
    return Response.json({ hourly_quota: 25, reputation: 0 });
  };

  const readiness = await checkTransactionalProviderReadiness();
  assert.equal(readiness.ready, false);
  assert.equal(readiness.provider, "mailchimp");
  assert.equal(readiness.reason, "demo_mode");
  assert.match(readiness.message, /demo-modus/);
});

test("reports paid-account provisioning separately when Mailchimp has no quota", async () => {
  process.env.MAILCHIMP_TRANSACTIONAL_API_KEY = "transactional-key";
  delete process.env.RESEND_API_KEY;
  global.fetch = async (input) => {
    assert.match(String(input), /users\/info/);
    return Response.json({ hourly_quota: 0, reputation: 33 });
  };

  const readiness = await checkTransactionalProviderReadiness();
  assert.equal(readiness.ready, false);
  assert.equal(readiness.provider, "mailchimp");
  assert.equal(readiness.reason, "quota_unavailable");
  assert.match(readiness.message, /verzendquota 0/);
  assert.doesNotMatch(readiness.message, /demo-modus/);
});

test("requires verified SPF and DKIM for Mailchimp production sending", async () => {
  process.env.MAILCHIMP_TRANSACTIONAL_API_KEY = "transactional-key";
  delete process.env.RESEND_API_KEY;
  global.fetch = async (input) => {
    if (String(input).includes("users/info")) return Response.json({ hourly_quota: 500 });
    return Response.json([{
      domain: "denotenman.com",
      verified_at: "2026-08-19 12:00:00",
      spf: { valid: true },
      dkim: { valid: false },
    }]);
  };

  const readiness = await checkTransactionalProviderReadiness();
  assert.equal(readiness.ready, false);
  assert.match(readiness.message, /DKIM/);
});

test("marks a paid Mailchimp account with an authenticated domain as ready", async () => {
  process.env.MAILCHIMP_TRANSACTIONAL_API_KEY = "transactional-key";
  delete process.env.RESEND_API_KEY;
  global.fetch = async (input) => {
    if (String(input).includes("users/info")) return Response.json({ hourly_quota: 500 });
    return Response.json([{
      domain: "denotenman.com",
      verified_at: "2026-08-19 12:00:00",
      spf: { valid: true },
      dkim: { valid: true },
    }]);
  };

  const readiness = await checkTransactionalProviderReadiness();
  assert.equal(readiness.ready, true);
  assert.match(readiness.message, /productiegeschikt/);
});

test("quota-zero admin guidance leads to billing before the Transactional dashboard", () => {
  const source = readFileSync(
    new URL("../app/admin/(dashboard)/marketing/aftersales/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /https:\/\/admin\.mailchimp\.com\/account\/billing\/plans/);
  assert.match(source, /Rond laagste bundel af in Billing/);
  assert.match(source, /minimaal 1 blok van 25\.000 e-mails/);
  assert.match(source, /Controleer daarna de Transactional-quota/);
});
