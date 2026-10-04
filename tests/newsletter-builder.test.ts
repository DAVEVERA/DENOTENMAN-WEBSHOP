import assert from "node:assert/strict";
import test from "node:test";

import { newsletterDraftSchema } from "../lib/mailchimp/schemas";
import { extractNewsletterContent } from "../lib/mailchimp/template";
import {
  createNewsletterBlock,
  DEFAULT_NEWSLETTER_THEME,
  documentFromLegacyHtml,
  newsletterDocumentSchema,
  starterNewsletterDocument,
  type NewsletterBlock,
  type NewsletterDocument,
} from "../lib/newsletter/document";
import { renderNewsletterEmail, renderRichText } from "../lib/newsletter/render";
import { youtubeId } from "../lib/newsletter/video";

const meta = { subject: "Najaar & noten", previewText: "Nieuw in de kraam" };
const doc = (blocks: NewsletterBlock[]): NewsletterDocument => ({ version: 1, theme: structuredClone(DEFAULT_NEWSLETTER_THEME), blocks });

test("every new block and the starter template pass validation", () => {
  const types = ["heading", "text", "image", "video", "button", "icons", "columns", "products", "table", "quote", "divider", "spacer", "social", "html"] as const;
  for (const type of types) assert.equal(newsletterDocumentSchema.safeParse(doc([createNewsletterBlock(type)])).success, true, type);
  assert.equal(newsletterDocumentSchema.safeParse(starterNewsletterDocument()).success, true);
});

test("the document rejects unsafe values instead of storing them", () => {
  const bad = doc([{ ...createNewsletterBlock("button"), url: "javascript:alert(1)" } as NewsletterBlock]);
  assert.equal(newsletterDocumentSchema.safeParse(bad).success, false);
  const badColor = doc([{ ...createNewsletterBlock("heading"), color: "red;background:url(x)" } as NewsletterBlock]);
  assert.equal(newsletterDocumentSchema.safeParse(badColor).success, false);
  const httpImage = doc([{ ...createNewsletterBlock("image"), url: "http://example.com/a.png" } as NewsletterBlock]);
  assert.equal(newsletterDocumentSchema.safeParse(httpImage).success, false, "images must be https");
});

test("text markup becomes paragraphs, lists, bold, italic and safe links", () => {
  const html = renderRichText("Hallo *|FNAME|*,\n\nDit is **vet** en *schuin*.\n\n- Eén\n- Twee\n\nKijk [hier](https://denotenman.com) of [niet](javascript:alert(1)).", DEFAULT_NEWSLETTER_THEME, "");
  assert.match(html, /Hallo \*\|FNAME\|\*,/u, "merge tags stay intact");
  assert.match(html, /<strong>vet<\/strong>/u);
  assert.match(html, /<em>schuin<\/em>/u);
  assert.match(html, /<ul[^>]*><li[^>]*>Eén<\/li><li[^>]*>Twee<\/li><\/ul>/u);
  assert.match(html, /<a href="https:\/\/denotenman\.com"/u);
  assert.doesNotMatch(html, /href="javascript:/u, "unsafe links stay plain text");
});

test("all text is escaped and raw HTML only passes the sanitizer", () => {
  const html = renderNewsletterEmail(doc([
    { ...createNewsletterBlock("heading"), text: "<script>alert(1)</script>Noten" } as NewsletterBlock,
    { ...createNewsletterBlock("html"), html: '<p>Eigen</p><script>alert(2)</script><img src="x" onerror="alert(3)">' } as NewsletterBlock,
  ]), meta);
  assert.doesNotMatch(html, /<script>/u);
  assert.doesNotMatch(html, /onerror/u);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;Noten/u);
  assert.match(html, /<p>Eigen<\/p>/u);
  assert.match(html, /<title>Najaar &amp; noten<\/title>/u);
});

test("the email always carries the legally required footer and unsubscribe link", () => {
  const theme = { ...structuredClone(DEFAULT_NEWSLETTER_THEME), footer: { text: "", showArchiveLink: false } };
  const html = renderNewsletterEmail({ version: 1, theme, blocks: [createNewsletterBlock("text")] }, meta);
  assert.match(html, /\*\|LIST:ADDRESS\|\*/u);
  assert.match(html, /\*\|UNSUB\|\*/u);
  assert.doesNotMatch(html, /\*\|ARCHIVE\|\*/u);
});

test("the preview shows sample values and hints; the sent email keeps merge tags and skips empty blocks", () => {
  const document = doc([createNewsletterBlock("text"), createNewsletterBlock("image"), createNewsletterBlock("products")]);
  const preview = renderNewsletterEmail(document, meta, { preview: true });
  assert.match(preview, /Hallo Fedor,/u);
  assert.match(preview, /Kies een afbeelding/u);
  assert.match(preview, /Kies producten/u);
  const sent = renderNewsletterEmail(document, meta);
  assert.match(sent, /Hallo \*\|FNAME\|\*,/u);
  assert.doesNotMatch(sent, /Kies een afbeelding|Kies producten/u);
});

test("products, columns and video render as linked, stackable email blocks", () => {
  const html = renderNewsletterEmail(doc([
    { id: "p", type: "products", columns: 2, buttonText: "Bekijk", items: [
      { productId: "1", name: "Cashewnoten", imageUrl: "https://cdn.example.com/c.jpg", priceLabel: "vanaf € 4,95", url: "https://denotenman.com/nl/producten/cashewnoten" },
      { productId: "2", name: "Amandelen", imageUrl: "", priceLabel: "€ 3,95", url: "https://denotenman.com/nl/producten/amandelen" },
    ] },
    { id: "v", type: "video", videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", thumbnailUrl: "https://cdn.example.com/t.jpg", posterUrl: "", aspect: "16:9", width: 60, align: "right", title: "Zo branden wij", caption: "" },
  ]), meta);
  assert.match(html, /class="dnm-col"/u, "columns stack on phones");
  assert.match(html, /vanaf € 4,95/u);
  assert.match(html, /href="https:\/\/www\.youtube\.com\/watch\?v=dQw4w9WgXcQ" style="display:inline-block;width:60%;max-width:100%"><img src="https:\/\/cdn\.example\.com\/t\.jpg"/u);
  assert.match(html, /text-align:right"><a href="https:\/\/www\.youtube/u, "the thumbnail follows the chosen alignment");
  assert.match(html, /▶ Zo branden wij/u);
});

test("video blocks saved before width, shape and alignment existed still open", () => {
  const parsed = newsletterDocumentSchema.parse({
    version: 1,
    theme: DEFAULT_NEWSLETTER_THEME,
    blocks: [{ id: "v", type: "video", videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", thumbnailUrl: "https://cdn.example.com/t.jpg", title: "", caption: "" }],
  });
  const video = parsed.blocks[0];
  assert.equal(video.type, "video");
  if (video.type !== "video") return;
  assert.equal(video.width, 100);
  assert.equal(video.align, "center");
  assert.equal(video.aspect, "16:9");
  assert.equal(video.posterUrl, "");
});

test("older newsletters open as one HTML block and still extract their content", () => {
  const legacy = documentFromLegacyHtml("<p>Oude nieuwsbrief</p>");
  assert.equal(legacy.blocks[0].type, "html");
  const html = renderNewsletterEmail(legacy, meta);
  assert.match(extractNewsletterContent(html), /Oude nieuwsbrief/u);
});

test("the draft schema accepts a block document next to the classic fields", () => {
  const parsed = newsletterDraftSchema.safeParse({
    subject: "Onderwerp", previewText: "", title: "Titel", fromName: "De Notenman", replyTo: "info@denotenman.com",
    contentHtml: "<p>x</p>", audience: "all", document: starterNewsletterDocument(),
  });
  assert.equal(parsed.success, true);
});

test("YouTube links of every kind give the video id", () => {
  for (const url of ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://youtu.be/dQw4w9WgXcQ", "https://www.youtube.com/shorts/dQw4w9WgXcQ", "https://www.youtube.com/watch?feature=share&v=dQw4w9WgXcQ"]) {
    assert.equal(youtubeId(url), "dQw4w9WgXcQ", url);
  }
  assert.equal(youtubeId("https://vimeo.com/123"), null);
});
