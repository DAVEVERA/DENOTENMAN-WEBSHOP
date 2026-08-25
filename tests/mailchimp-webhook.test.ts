import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  mailchimpConsentStatusMutation,
  parseMailchimpWebhook,
  verifyMailchimpWebhookSignature,
} from "../lib/mailchimp/webhook";

const secret = "a-strong-webhook-secret-123456";
const timestamp = 1_718_000_000;
const rawBody = "type=unsubscribe&data%5Bemail%5D=Person%40Example.COM";
const signature = createHmac("sha256", secret)
  .update(`${timestamp}.${rawBody}`, "utf8")
  .digest("hex");

assert.equal(
  verifyMailchimpWebhookSignature({
    rawBody,
    signatureHeader: `t=${timestamp},v1=${signature}`,
    secret,
    nowSeconds: timestamp + 30,
  }),
  true
);
assert.equal(
  verifyMailchimpWebhookSignature({
    rawBody,
    signatureHeader: `t=${timestamp},v1=${"0".repeat(64)}`,
    secret,
    nowSeconds: timestamp + 30,
  }),
  false
);
assert.equal(
  verifyMailchimpWebhookSignature({
    rawBody,
    signatureHeader: `t=${timestamp},v1=${signature}`,
    secret,
    nowSeconds: timestamp + 301,
  }),
  false
);
assert.equal(
  verifyMailchimpWebhookSignature({
    rawBody,
    signatureHeader: null,
    secret,
    nowSeconds: timestamp,
  }),
  false
);

const unsubscribe = new FormData();
unsubscribe.set("type", "unsubscribe");
unsubscribe.set("data[email]", " Person@Example.COM ");
unsubscribe.set("data[merges][FNAME]", "Piet");
unsubscribe.set("data[merges][LOCALE]", "fr");
assert.deepEqual(parseMailchimpWebhook(unsubscribe), {
  type: "unsubscribe",
  email: "person@example.com",
  firstName: "Piet",
  locale: "fr",
});

const subscribe = new FormData();
subscribe.set("type", "subscribe");
subscribe.set("data[email]", "New@Example.COM");
subscribe.set("data[merges][LOCALE]", "nl");
assert.deepEqual(parseMailchimpWebhook(subscribe), {
  type: "subscribe",
  email: "new@example.com",
  locale: "nl",
});

const webhookTime = new Date("2026-08-24T10:00:00.000Z");
assert.deepEqual(mailchimpConsentStatusMutation({ type: "subscribe", email: "new@example.com", locale: "nl" }, null, webhookTime), {
  status: "SUBSCRIBED",
  optInAt: webhookTime,
  optOutAt: null,
});
assert.deepEqual(
  mailchimpConsentStatusMutation(
    { type: "unsubscribe", email: "new@example.com" },
    { optInAt: webhookTime, optOutAt: null },
    webhookTime
  ),
  { status: "UNSUBSCRIBED", optOutAt: webhookTime }
);
assert.deepEqual(
  mailchimpConsentStatusMutation(
    { type: "cleaned", email: "new@example.com" },
    { optInAt: webhookTime, optOutAt: webhookTime },
    new Date("2026-08-24T11:00:00.000Z")
  ),
  { status: "CLEANED", optOutAt: webhookTime }
);

const changedEmail = new FormData();
changedEmail.set("type", "upemail");
changedEmail.set("data[old_email]", "old@example.com");
changedEmail.set("data[new_email]", "NEW@example.com");
assert.deepEqual(parseMailchimpWebhook(changedEmail), {
  type: "upemail",
  oldEmail: "old@example.com",
  newEmail: "new@example.com",
});

const unsupported = new FormData();
unsupported.set("type", "campaign");
assert.equal(parseMailchimpWebhook(unsupported), null);

console.log("Mailchimp webhook verification tests passed");
