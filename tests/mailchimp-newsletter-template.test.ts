import assert from "node:assert/strict";
import {
  buildNewsletterHtml,
  extractNewsletterContent,
  sanitizeNewsletterContent,
} from "../lib/mailchimp/template";

const dirty = '<h1>Nieuwe noten</h1><script>alert("x")</script><a href="javascript:alert(1)">Klik</a>';
const sanitized = sanitizeNewsletterContent(dirty);
assert.equal(sanitized.includes("<script"), false);
assert.equal(sanitized.includes("javascript:"), false);
assert.equal(sanitized.includes("Nieuwe noten"), true);

const html = buildNewsletterHtml({
  subject: "Proef & geniet",
  previewText: "Nieuwe producten",
  title: "Nieuwsbrief augustus",
  fromName: "De Notenman",
  replyTo: "info@denotenman.com",
  contentHtml: "<p>Welkom <strong>terug</strong>.</p>",
});
assert.equal(html.includes("Proef &amp; geniet"), true);
assert.equal(html.includes("*|UNSUB|*"), true);
assert.equal(html.includes("*|LIST:ADDRESS|*"), true);
assert.equal(extractNewsletterContent(html), "<p>Welkom <strong>terug</strong>.</p>");

console.log("Mailchimp newsletter template tests passed");
