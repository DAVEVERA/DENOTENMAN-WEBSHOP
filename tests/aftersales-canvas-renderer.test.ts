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
  const html = renderAftersalesCanvas(canvas, { t1: "Hallo <script>" }, { ...baseOptions, resolveText: (key) => ({ t1: "Hallo <script>" })[key] ?? "" });
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
  const html = renderAftersalesCanvas(withImage, {}, { ...baseOptions, resolveText: () => "" });
  assert.match(html, /src="https:\/\/cdn\.example\/a\.png"/);
  assert.match(html, /alt="Logo"/);
  assert.match(html, /width="300"/);

  const withoutImage: AftersalesCanvas = { rows: [{ id: "r1", backgroundColor: "#fff", padding: 0, columns: [{ id: "c1", widthFraction: 1, backgroundColor: "#fff", padding: 0, blocks: [{ id: "i2", type: "image", mediaUrl: null, alt: "", width: 300, align: "left", linkUrl: null }] }] }] };
  const emptyHtml = renderAftersalesCanvas(withoutImage, {}, { ...baseOptions, resolveText: () => "" });
  assert.doesNotMatch(emptyHtml, /<img/);
});

test("a button block falls back to defaultActionUrl when its own linkUrl is null", () => {
  const canvas: AftersalesCanvas = {
    rows: [{ id: "r1", backgroundColor: "#fff", padding: 0, columns: [{ id: "c1", widthFraction: 1, backgroundColor: "#fff", padding: 0, blocks: [{ id: "b1", type: "button", backgroundColor: "#e0b200", textColor: "#141414", borderRadius: 8, linkUrl: null }] }] }],
  };
  const html = renderAftersalesCanvas(canvas, { b1: "Bekijk" }, { ...baseOptions, resolveText: (key) => ({ b1: "Bekijk" })[key] ?? "" });
  assert.match(html, /href="https:\/\/denotenman\.com\/nl\/account"/);
  assert.match(html, /border-radius:8px/);
});

test("a spacer block renders its exact height and only shows a divider when configured", () => {
  const withDivider: AftersalesCanvas = { rows: [{ id: "r1", backgroundColor: "#fff", padding: 0, columns: [{ id: "c1", widthFraction: 1, backgroundColor: "#fff", padding: 0, blocks: [{ id: "s1", type: "spacer", heightPx: 40, showDivider: true }] }] }] };
  const html = renderAftersalesCanvas(withDivider, {}, { ...baseOptions, resolveText: () => "" });
  assert.match(html, /height:40px/);
  assert.match(html, /border-top/);

  const noDivider: AftersalesCanvas = { rows: [{ id: "r1", backgroundColor: "#fff", padding: 0, columns: [{ id: "c1", widthFraction: 1, backgroundColor: "#fff", padding: 0, blocks: [{ id: "s2", type: "spacer", heightPx: 20, showDivider: false }] }] }] };
  const html2 = renderAftersalesCanvas(noDivider, {}, { ...baseOptions, resolveText: () => "" });
  assert.doesNotMatch(html2, /border-top/);
});

test("row and column background colors and padding are applied to the generated table structure", () => {
  const canvas: AftersalesCanvas = { rows: [{ id: "r1", backgroundColor: "#fdf6e3", padding: 32, columns: [{ id: "c1", widthFraction: 1, backgroundColor: "#ffffff", padding: 16, blocks: [] }] }] };
  const html = renderAftersalesCanvas(canvas, {}, { ...baseOptions, resolveText: () => "" });
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
  const html = renderAftersalesCanvas(canvas, {}, { ...baseOptions, resolveText: () => "" });
  assert.match(html, /width="30%"/);
  assert.match(html, /width="70%"/);
});
