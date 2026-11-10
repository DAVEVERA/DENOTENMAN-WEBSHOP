import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the editor preview calls the shared canvas renderer instead of building its own HTML", async () => {
  const source = await readFile("app/admin/(dashboard)/marketing/aftersales/AftersalesFlowEditor.tsx", "utf8");
  assert.match(source, /renderAftersalesCanvas/);
  assert.match(source, /from "@\/lib\/aftersales\/canvas-renderer"/);
});

test("the preview imposes no order number on the review mail", async () => {
  const source = await readFile("app/admin/(dashboard)/marketing/aftersales/AftersalesFlowEditor.tsx", "utf8");
  const box = source.slice(source.indexOf("const orderNumberBox"), source.indexOf("const detail"));
  assert.ok(box.length > 0, "the preview's order-number box moved; this guard needs updating");
  assert.match(box, /REVIEW_REQUEST/, "the review preview still shows a hardcoded order number");
});

test("the preview honours the admin's logo alignment, height and alt text", async () => {
  const source = await readFile("app/admin/(dashboard)/marketing/aftersales/AftersalesFlowEditor.tsx", "utf8");
  const preview = source.slice(source.indexOf("function previewDocument"), source.indexOf("function formatDate"));
  assert.match(preview, /design\.logoAlign/, "the preview ignores logo alignment");
  assert.match(preview, /design\.logoHeightPx/, "the preview ignores the logo height");
  assert.match(preview, /design\.logoAlt/, "the preview ignores the logo alt text");
  assert.ok(!preview.includes("height:32px"), "the preview still hardcodes a 32px logo");
});
