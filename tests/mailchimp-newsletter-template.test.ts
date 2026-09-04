import assert from "node:assert/strict";
import {
  buildNewsletterHtml,
  extractNewsletterContent,
  sanitizeNewsletterContent,
} from "../lib/mailchimp/template";
import { buildGridBlockHtml, buildTableBlockHtml } from "../lib/mailchimp/blocks";

const dirty = '<h1>Nieuwe noten</h1><script>alert("x")</script><a href="javascript:alert(1)">Klik</a>';
const sanitized = sanitizeNewsletterContent(dirty);
assert.equal(sanitized.includes("<script"), false);
assert.equal(sanitized.includes("javascript:"), false);
assert.equal(sanitized.includes("Nieuwe noten"), true);

const withImage = sanitizeNewsletterContent(
  '<p>Kijk</p><img src="https://cdn.example.com/media-library/abc.jpg" alt="Test" style="display:block;width:100%;max-width:600px;height:auto;border-radius:8px" onerror="alert(1)" />'
);
assert.equal(withImage.includes('src="https://cdn.example.com/media-library/abc.jpg"'), true);
assert.equal(withImage.includes("border-radius:8px"), true);
assert.equal(withImage.includes("onerror"), false);

const badImageScheme = sanitizeNewsletterContent('<img src="javascript:alert(1)" alt="bad" />');
assert.equal(badImageScheme.includes("javascript:"), false);

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

const gridHtml = buildGridBlockHtml([
  { imageUrl: "https://cdn.example.com/media-library/grid.jpg", imageAlt: "Grid", heading: "Amandelen", body: "Vers gebrand" },
  { imageUrl: null, imageAlt: "", heading: "", body: "" },
]);
assert.equal(gridHtml.includes("<table"), true);
const sanitizedGrid = sanitizeNewsletterContent(gridHtml);
assert.equal(sanitizedGrid.includes("<table"), true);
assert.equal(sanitizedGrid.includes("<td"), true);
assert.equal(sanitizedGrid.includes('src="https://cdn.example.com/media-library/grid.jpg"'), true);
assert.equal(sanitizedGrid.includes("Amandelen"), true);
assert.equal(sanitizedGrid.includes("Vers gebrand"), true);
assert.equal(sanitizedGrid.includes("margin:0 0 8px"), true);
assert.equal(sanitizedGrid.includes("margin:0 0 4px"), true);

const emptyGridHtml = buildGridBlockHtml([{ imageUrl: null, imageAlt: "", heading: "", body: "" }]);
assert.equal(emptyGridHtml, "");

const tableHtml = buildTableBlockHtml(["Product", "Prijs"], [["Cashewnoten", "€ 4,50"]]);
assert.equal(tableHtml.includes("<table"), true);
const sanitizedTable = sanitizeNewsletterContent(tableHtml);
assert.equal(sanitizedTable.includes("<thead"), true);
assert.equal(sanitizedTable.includes("<th"), true);
assert.equal(sanitizedTable.includes("Product"), true);
assert.equal(sanitizedTable.includes("Cashewnoten"), true);
assert.equal(sanitizedTable.includes("border-collapse:collapse"), true);

const emptyTableHtml = buildTableBlockHtml(["Kolom"], []);
assert.equal(emptyTableHtml, "");

const xssTable = sanitizeNewsletterContent(
  '<table width="100%" style="border-collapse:collapse;background:url(javascript:alert(1))"><tbody><tr><td style="padding:8px 10px;color:red" onclick="alert(1)"><script>alert(1)</script>Noten</td></tr></tbody></table>'
);
assert.equal(xssTable.includes("<script"), false);
assert.equal(xssTable.includes("onclick"), false);
assert.equal(xssTable.includes("javascript:"), false);
assert.equal(xssTable.includes("background"), false);
assert.equal(xssTable.includes('style="color:red"'), false);
assert.equal(xssTable.includes("Noten"), true);

console.log("Mailchimp newsletter template tests passed");
