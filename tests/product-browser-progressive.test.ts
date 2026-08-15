import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("homepage progressively reveals the filtered catalog instead of rendering every product", () => {
  const source = readFileSync("components/product/ProductBrowser.tsx", "utf8");
  assert.match(source, /INITIAL_VISIBLE_PRODUCTS\s*=\s*24/);
  assert.match(source, /filtered\.slice\(0, visibleCount\)/);
  assert.match(source, /setVisibleCount\(\(current\) => current \+ INITIAL_VISIBLE_PRODUCTS\)/);
  assert.match(source, /dictionary\.filters\.loadMore/);
});
