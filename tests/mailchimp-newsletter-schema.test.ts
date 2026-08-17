import assert from "node:assert/strict";
import {
  newsletterDraftSchema,
  newsletterScheduleSchema,
  newsletterSendSchema,
  newsletterTestSchema,
} from "../lib/mailchimp/schemas";

const draft = {
  subject: "Nieuwe noten",
  previewText: "Vers binnen",
  title: "Nieuwsbrief augustus",
  fromName: "De Notenman",
  replyTo: "info@denotenman.com",
  contentHtml: "<p>Bekijk het assortiment.</p>",
};

assert.equal(newsletterDraftSchema.safeParse(draft).success, true);
assert.equal(
  newsletterDraftSchema.safeParse({
    subject: draft.subject,
    bodyHtml: draft.contentHtml,
    status: "DRAFT",
    scheduledAt: null,
  }).success,
  false
);
assert.equal(newsletterTestSchema.safeParse({ email: "test@example.com" }).success, true);
assert.equal(newsletterSendSchema.safeParse({ confirm: true }).success, true);
assert.equal(newsletterSendSchema.safeParse({ confirm: false }).success, false);
assert.equal(
  newsletterScheduleSchema.safeParse({
    scheduleTime: new Date(Date.now() + 60_000).toISOString(),
    confirm: true,
  }).success,
  true
);

console.log("Mailchimp newsletter contract tests passed");
