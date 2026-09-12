import assert from "node:assert/strict";
import test from "node:test";
import { renderAftersalesCanvas } from "../lib/aftersales/canvas-renderer";
import { blockTextKey, type AftersalesCanvas } from "../lib/aftersales/schema";

function escapeText(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

const baseOptions = { escapeText, defaultActionUrl: "https://denotenman.com/nl/account" };

test("a text block renders its resolved text with its own font size and color inline, no CSS classes", () => {
  const canvas: AftersalesCanvas = {
    rows: [{ id: "r1", backgroundColor: "#ffffff", padding: 10, columns: [{ id: "c1", widthFraction: 1, backgroundColor: "#ffffff", padding: 0, blocks: [{ id: "t1", type: "text", font: "SANS", size: "GROOT", color: "#141414", align: "center", bold: true, italic: false }] }] }],
  };
  const html = renderAftersalesCanvas(canvas, { ...baseOptions, resolveText: (key) => ({ t1: "Hallo <script>" })[key] ?? "" });
  assert.match(html, /Hallo &lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /text-align:center/);
  assert.match(html, /font-weight:700/);
  assert.doesNotMatch(html, /class=/);
  assert.doesNotMatch(html, /position:\s*absolute/);
  assert.doesNotMatch(html, /display:\s*grid/);
});

test("an image block renders with the configured width and alt text, and no image renders nothing", () => {
  const withImage: AftersalesCanvas = {
    rows: [{ id: "r1", backgroundColor: "#fff", padding: 0, columns: [{ id: "c1", widthFraction: 1, backgroundColor: "#fff", padding: 0, blocks: [{ id: "i1", type: "image", mediaUrl: "https://cdn.example/a.png", alt: "Logo", width: 300, align: "left", linkUrl: null }] }] }],
  };
  const html = renderAftersalesCanvas(withImage, { ...baseOptions, resolveText: () => "" });
  assert.match(html, /src="https:\/\/cdn\.example\/a\.png"/);
  assert.match(html, /alt="Logo"/);
  assert.match(html, /width="300"/);

  const withoutImage: AftersalesCanvas = { rows: [{ id: "r1", backgroundColor: "#fff", padding: 0, columns: [{ id: "c1", widthFraction: 1, backgroundColor: "#fff", padding: 0, blocks: [{ id: "i2", type: "image", mediaUrl: null, alt: "", width: 300, align: "left", linkUrl: null }] }] }] };
  const emptyHtml = renderAftersalesCanvas(withoutImage, { ...baseOptions, resolveText: () => "" });
  assert.doesNotMatch(emptyHtml, /<img/);
});

test("a button block falls back to defaultActionUrl when its own linkUrl is null", () => {
  const canvas: AftersalesCanvas = {
    rows: [{ id: "r1", backgroundColor: "#fff", padding: 0, columns: [{ id: "c1", widthFraction: 1, backgroundColor: "#fff", padding: 0, blocks: [{ id: "b1", type: "button", backgroundColor: "#e0b200", textColor: "#141414", borderRadius: 8, linkUrl: null }] }] }],
  };
  const html = renderAftersalesCanvas(canvas, { ...baseOptions, resolveText: (key) => ({ b1: "Bekijk" })[key] ?? "" });
  assert.match(html, /href="https:\/\/denotenman\.com\/nl\/account"/);
  assert.match(html, /border-radius:8px/);
});

test("a spacer block renders its exact height and only shows a divider when configured", () => {
  const withDivider: AftersalesCanvas = { rows: [{ id: "r1", backgroundColor: "#fff", padding: 0, columns: [{ id: "c1", widthFraction: 1, backgroundColor: "#fff", padding: 0, blocks: [{ id: "s1", type: "spacer", heightPx: 40, showDivider: true }] }] }] };
  const html = renderAftersalesCanvas(withDivider, { ...baseOptions, resolveText: () => "" });
  assert.match(html, /height:40px/);
  assert.match(html, /border-top/);

  const noDivider: AftersalesCanvas = { rows: [{ id: "r1", backgroundColor: "#fff", padding: 0, columns: [{ id: "c1", widthFraction: 1, backgroundColor: "#fff", padding: 0, blocks: [{ id: "s2", type: "spacer", heightPx: 20, showDivider: false }] }] }] };
  const html2 = renderAftersalesCanvas(noDivider, { ...baseOptions, resolveText: () => "" });
  assert.doesNotMatch(html2, /border-top/);
});

test("row and column background colors and padding are applied to the generated table structure", () => {
  const canvas: AftersalesCanvas = { rows: [{ id: "r1", backgroundColor: "#fdf6e3", padding: 32, columns: [{ id: "c1", widthFraction: 1, backgroundColor: "#ffffff", padding: 16, blocks: [] }] }] };
  const html = renderAftersalesCanvas(canvas, { ...baseOptions, resolveText: () => "" });
  assert.match(html, /background(-color)?:\s*#fdf6e3/);
  assert.match(html, /padding:32px/);
  assert.match(html, /background(-color)?:\s*#ffffff/);
  assert.match(html, /padding:16px/);
});

test("a row with two columns renders them side by side in one HTML table row, width proportional to widthFraction", () => {
  const canvas: AftersalesCanvas = {
    rows: [{ id: "r1", backgroundColor: "#fff", padding: 0, columns: [
      { id: "c1", widthFraction: 0.3, backgroundColor: "#fff", padding: 0, blocks: [] },
      { id: "c2", widthFraction: 0.7, backgroundColor: "#fff", padding: 0, blocks: [] },
    ] }],
  };
  const html = renderAftersalesCanvas(canvas, { ...baseOptions, resolveText: () => "" });
  assert.match(html, /width="30%"/);
  assert.match(html, /width="70%"/);
});

test("a hero block renders an overlay heading, body and button over its background", () => {
  const canvas: AftersalesCanvas = {
    rows: [{ id: "r1", backgroundColor: "#fff", padding: 0, columns: [{ id: "c1", widthFraction: 1, backgroundColor: "#fff", padding: 0, blocks: [{ id: "h1", type: "hero", backgroundUrl: "https://cdn.example/bg.jpg", backgroundColor: "#222222", buttonColor: "#e0b200", buttonTextColor: "#141414" }] }] }],
  };
  const text: Record<string, string> = { "h1:heading": "Welkom", "h1:body": "Fijn dat je er bent", "h1:button": "Ga verder" };
  const html = renderAftersalesCanvas(canvas, { ...baseOptions, resolveText: (key) => text[key] ?? "" });
  assert.match(html, /Welkom/);
  assert.match(html, /Fijn dat je er bent/);
  assert.match(html, /Ga verder/);
  assert.match(html, /background:#222222/);
  assert.match(html, /https:\/\/cdn\.example\/bg\.jpg/);
});

test("a hero block without a background image still renders on its backgroundColor", () => {
  const canvas: AftersalesCanvas = { rows: [{ id: "r1", backgroundColor: "#fff", padding: 0, columns: [{ id: "c1", widthFraction: 1, backgroundColor: "#fff", padding: 0, blocks: [{ id: "h2", type: "hero", backgroundUrl: null, backgroundColor: "#333333", buttonColor: "#e0b200", buttonTextColor: "#141414" }] }] }] };
  const html = renderAftersalesCanvas(canvas, { ...baseOptions, resolveText: (key) => ({ "h2:heading": "Kop", "h2:body": "Tekst", "h2:button": "Knop" } as Record<string, string>)[key] ?? "" });
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /background:#333333/);
});

test("a banner block renders its text on its background", () => {
  const canvas: AftersalesCanvas = { rows: [{ id: "r1", backgroundColor: "#fff", padding: 0, columns: [{ id: "c1", widthFraction: 1, backgroundColor: "#fff", padding: 0, blocks: [{ id: "ban1", type: "banner", backgroundUrl: null, backgroundColor: "#fbe9a0", textColor: "#141414" }] }] }] };
  const html = renderAftersalesCanvas(canvas, { ...baseOptions, resolveText: (key) => (key === "ban1" ? "20% korting deze week" : "") });
  assert.match(html, /20% korting deze week/);
  assert.match(html, /background:#fbe9a0/);
});

test("a customHtml block renders its resolved value verbatim, unescaped", () => {
  const canvas: AftersalesCanvas = { rows: [{ id: "r1", backgroundColor: "#fff", padding: 0, columns: [{ id: "c1", widthFraction: 1, backgroundColor: "#fff", padding: 0, blocks: [{ id: "html1", type: "customHtml" }] }] }] };
  const html = renderAftersalesCanvas(canvas, { ...baseOptions, resolveText: (key) => (key === "html1" ? "<p style=\"color:red\">Vrij HTML</p>" : "") });
  assert.match(html, /<p style="color:red">Vrij HTML<\/p>/);
});

test("a table block renders its headers and, per row, each cell resolved through blockText", () => {
  const canvas: AftersalesCanvas = {
    rows: [{ id: "r1", backgroundColor: "#fff", padding: 0, columns: [{ id: "c1", widthFraction: 1, backgroundColor: "#fff", padding: 0, blocks: [{ id: "tbl1", type: "table", headerCount: 2, rowIds: ["row-a"] }] }] }],
  };
  const text: Record<string, string> = {
    "tbl1:header:0": "Product",
    "tbl1:header:1": "Prijs",
    "tbl1:cell:row-a:0": "Amandelen",
    "tbl1:cell:row-a:1": "€ 4,95",
  };
  const html = renderAftersalesCanvas(canvas, { ...baseOptions, resolveText: (key) => text[key] ?? "" });
  assert.match(html, /<th[^>]*>Product<\/th>/);
  assert.match(html, /<th[^>]*>Prijs<\/th>/);
  assert.match(html, /Amandelen/);
  assert.match(html, /€ 4,95/);
});

test("a grid block renders up to 4 items, each with its own image, heading and body", () => {
  const canvas: AftersalesCanvas = {
    rows: [{ id: "r1", backgroundColor: "#fff", padding: 0, columns: [{ id: "c1", widthFraction: 1, backgroundColor: "#fff", padding: 0, blocks: [{ id: "grid1", type: "grid", items: [
      { id: "item-0", imageUrl: "https://cdn.example/1.png", imageAlt: "Alt 1" },
      { id: "item-1", imageUrl: null, imageAlt: "" },
    ] }] }] }],
  };
  const text: Record<string, string> = { "item-0:heading": "Kop 1", "item-0:body": "Body 1", "item-1:heading": "Kop 2", "item-1:body": "Body 2" };
  const html = renderAftersalesCanvas(canvas, { ...baseOptions, resolveText: (key) => text[key] ?? "" });
  assert.match(html, /Kop 1/);
  assert.match(html, /Body 1/);
  assert.match(html, /Kop 2/);
  assert.match(html, /https:\/\/cdn\.example\/1\.png/);
});

// A fuller escaper (including quotes), matching what lib/aftersales/template.ts's
// real escapeHtml does - the local escapeText above only covers & < > and
// can't demonstrate a quote breaking out of an HTML attribute.
function escapeAttr(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
const attrOptions = { ...baseOptions, escapeText: escapeAttr };

test("an image block escapes mediaUrl, alt and linkUrl so a quote in admin-entered alt text can't break out of the attribute", () => {
  const canvas: AftersalesCanvas = {
    rows: [{ id: "r1", backgroundColor: "#fff", padding: 0, columns: [{ id: "c1", widthFraction: 1, backgroundColor: "#fff", padding: 0, blocks: [{ id: "i1", type: "image", mediaUrl: "https://cdn.example/a.png?x=1&y=2", alt: '" onerror="alert(1)', width: 300, align: "left", linkUrl: 'https://evil.example/"><script>' }] }] }],
  };
  const html = renderAftersalesCanvas(canvas, { ...attrOptions, resolveText: () => "" });
  assert.doesNotMatch(html, /" onerror="alert\(1\)/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&quot;/);
});

test("a hero block escapes its backgroundUrl", () => {
  const canvas: AftersalesCanvas = {
    rows: [{ id: "r1", backgroundColor: "#fff", padding: 0, columns: [{ id: "c1", widthFraction: 1, backgroundColor: "#fff", padding: 0, blocks: [{ id: "h3", type: "hero", backgroundUrl: "https://cdn.example/bg.jpg?a=1&b=2", backgroundColor: "#222222", buttonColor: "#e0b200", buttonTextColor: "#141414" }] }] }],
  };
  const html = renderAftersalesCanvas(canvas, { ...attrOptions, resolveText: () => "" });
  assert.match(html, /https:\/\/cdn\.example\/bg\.jpg\?a=1&amp;b=2/);
});

test("a banner block escapes its backgroundUrl", () => {
  const canvas: AftersalesCanvas = {
    rows: [{ id: "r1", backgroundColor: "#fff", padding: 0, columns: [{ id: "c1", widthFraction: 1, backgroundColor: "#fff", padding: 0, blocks: [{ id: "ban2", type: "banner", backgroundUrl: "https://cdn.example/bg.jpg?a=1&b=2", backgroundColor: "#fbe9a0", textColor: "#141414" }] }] }],
  };
  const html = renderAftersalesCanvas(canvas, { ...attrOptions, resolveText: () => "" });
  assert.match(html, /https:\/\/cdn\.example\/bg\.jpg\?a=1&amp;b=2/);
});

test("a grid block escapes each item's imageUrl and imageAlt", () => {
  const canvas: AftersalesCanvas = {
    rows: [{ id: "r1", backgroundColor: "#fff", padding: 0, columns: [{ id: "c1", widthFraction: 1, backgroundColor: "#fff", padding: 0, blocks: [{ id: "grid2", type: "grid", items: [{ id: "item-x", imageUrl: "https://cdn.example/x.png", imageAlt: '" onerror="alert(1)' }] }] }] }],
  };
  const html = renderAftersalesCanvas(canvas, { ...attrOptions, resolveText: () => "" });
  assert.doesNotMatch(html, /" onerror="alert\(1\)/);
  assert.match(html, /&quot;/);
});
