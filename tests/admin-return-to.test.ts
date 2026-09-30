import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { productEditorHref, safeCopywriterReturnTo } from "../lib/admin-return-to";

test("only internal CopyWriter pages are accepted as a return address", () => {
  for (const value of [
    "/admin/design-studio/copywriter",
    "/admin/design-studio/copywriter?filter=todo",
    "/admin/design-studio/copywriter/product_1?filter=todo&q=noten&locale=nl",
  ]) {
    assert.equal(safeCopywriterReturnTo(value), value);
  }
  for (const value of [
    "https://example.com/admin/design-studio/copywriter",
    "//example.com/admin/design-studio/copywriter",
    "/admin/producten",
    "javascript:alert(1)",
    "/admin/design-studio/copywriter/../../producten",
    "/admin/design-studio/copywriterx",
    "/admin/design-studio/copywriter?x=<script>",
    "",
    null,
    undefined,
  ]) {
    assert.equal(safeCopywriterReturnTo(value), null, String(value));
  }
  assert.equal(safeCopywriterReturnTo(["/admin/design-studio/copywriter", "/evil"]), "/admin/design-studio/copywriter");
});

test("the product editor link carries a safe return address only", () => {
  assert.equal(
    productEditorHref("product_1", "/admin/design-studio/copywriter/product_1?filter=todo&locale=nl"),
    "/admin/producten/product_1?terug=%2Fadmin%2Fdesign-studio%2Fcopywriter%2Fproduct_1%3Ffilter%3Dtodo%26locale%3Dnl",
  );
  assert.equal(productEditorHref("product_1", "https://example.com"), "/admin/producten/product_1");
  assert.equal(productEditorHref("product_1"), "/admin/producten/product_1");
});

test("the product editor offers a way back to the CopyWriter", () => {
  const page = readFileSync("app/admin/(dashboard)/producten/[id]/page.tsx", "utf8");
  assert.match(page, /safeCopywriterReturnTo\(\(await searchParams\)\.terug\)/);
  assert.match(page, /Terug naar CopyWriter/);
  assert.match(page, /Terug naar producten/);
});
