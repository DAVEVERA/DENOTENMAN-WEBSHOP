import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { EmailDeliveryKind } from "@prisma/client";
import { prisma } from "../lib/prisma";
import {
  deliverTransactionalEmail,
  retryTransactionalEmail,
} from "../lib/transactional-email";

test("logs every failed attempt, prevents duplicates and records an explicit retry", async () => {
  const idempotencyKey = `integration-email-log-${randomUUID()}`;
  const originalFetch = global.fetch;
  const originalTransactionalKey = process.env.MAILCHIMP_TRANSACTIONAL_API_KEY;
  const originalResendKey = process.env.RESEND_API_KEY;
  const originalMailFromEmail = process.env.MAIL_FROM_EMAIL;
  const originalMailFromAddress = process.env.MAIL_FROM_ADDRESS;
  const originalNodeTlsRejectUnauthorized = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  delete process.env.MAILCHIMP_TRANSACTIONAL_API_KEY;
  delete process.env.RESEND_API_KEY;
  process.env.MAIL_FROM_EMAIL = "bestellingen@denotenman.com";
  delete process.env.MAIL_FROM_ADDRESS;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "1";

  try {
    const first = await deliverTransactionalEmail({
      idempotencyKey,
      kind: EmailDeliveryKind.BACK_IN_STOCK,
      recipientEmail: "  Log.Test@Example.COM ",
      subject: "Voorraadmelding",
      html: "<p>Weer op voorraad</p>",
      text: "Weer op voorraad",
    });
    assert.equal(first.status, "failed");
    if (first.status !== "failed") return;
    assert.equal(first.code, "TRANSACTIONAL_PROVIDER_NOT_CONFIGURED");

    const failedLog = await prisma.emailDeliveryLog.findUniqueOrThrow({
      where: { id: first.logId },
      include: { attempts: true },
    });
    assert.equal(failedLog.recipientEmail, "log.test@example.com");
    assert.equal(failedLog.status, "FAILED");
    assert.equal(failedLog.provider, "NONE");
    assert.equal(failedLog.attempts.length, 1);
    assert.equal(failedLog.attempts[0]?.status, "FAILED");

    const duplicate = await deliverTransactionalEmail({
      idempotencyKey,
      kind: EmailDeliveryKind.BACK_IN_STOCK,
      recipientEmail: "log.test@example.com",
      subject: "Andere inhoud die niet verzonden mag worden",
      html: "<p>Anders</p>",
      text: "Anders",
    });
    assert.equal(duplicate.status, "duplicate");
    assert.equal(await prisma.emailDeliveryAttempt.count({ where: { deliveryId: first.logId } }), 1);

    process.env.MAILCHIMP_TRANSACTIONAL_API_KEY = "transactional-test-key";
    global.fetch = async (input) => {
      if (String(input).includes("users/info")) return Response.json({ hourly_quota: 500 });
      if (String(input).includes("senders/domains")) {
        return Response.json([{
          domain: "denotenman.com",
          verified_at: "2026-08-19 12:00:00",
          spf: { valid: true },
          dkim: { valid: true },
        }]);
      }
      return Response.json([
        { email: "log.test@example.com", status: "sent", _id: "provider-retry-123" },
      ]);
    };
    const retried = await retryTransactionalEmail(first.logId);
    assert.equal(retried.status, "accepted");

    const acceptedLog = await prisma.emailDeliveryLog.findUniqueOrThrow({
      where: { id: first.logId },
      include: { attempts: { orderBy: { attemptNumber: "asc" } } },
    });
    assert.equal(acceptedLog.status, "ACCEPTED");
    assert.equal(acceptedLog.providerMessageId, "provider-retry-123");
    assert.deepEqual(acceptedLog.attempts.map((attempt) => attempt.status), ["FAILED", "ACCEPTED"]);
  } finally {
    global.fetch = originalFetch;
    if (originalTransactionalKey === undefined) delete process.env.MAILCHIMP_TRANSACTIONAL_API_KEY;
    else process.env.MAILCHIMP_TRANSACTIONAL_API_KEY = originalTransactionalKey;
    if (originalResendKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalResendKey;
    if (originalMailFromEmail === undefined) delete process.env.MAIL_FROM_EMAIL;
    else process.env.MAIL_FROM_EMAIL = originalMailFromEmail;
    if (originalMailFromAddress === undefined) delete process.env.MAIL_FROM_ADDRESS;
    else process.env.MAIL_FROM_ADDRESS = originalMailFromAddress;
    if (originalNodeTlsRejectUnauthorized === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    else process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalNodeTlsRejectUnauthorized;
    await prisma.emailDeliveryLog.deleteMany({ where: { idempotencyKey } });
  }
});
