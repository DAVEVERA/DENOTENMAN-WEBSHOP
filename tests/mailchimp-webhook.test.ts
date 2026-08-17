import assert from "node:assert/strict";
import {
  parseMailchimpWebhook,
  verifyMailchimpWebhookSecret,
} from "../lib/mailchimp/webhook";

const secret = "a-strong-webhook-secret-123456";
assert.equal(
  verifyMailchimpWebhookSecret(`https://example.com/api/webhooks/mailchimp?secret=${secret}`, secret),
  true
);
assert.equal(
  verifyMailchimpWebhookSecret("https://example.com/api/webhooks/mailchimp?secret=wrong", secret),
  false
);
assert.equal(verifyMailchimpWebhookSecret("https://example.com/api/webhooks/mailchimp", secret), false);

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
