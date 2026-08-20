import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("merchant feed is cached and invalidated after product mutations", () => {
  const route = readFileSync("app/google-merchant.xml/route.ts", "utf8");
  const revalidation = readFileSync("lib/product-revalidation.ts", "utf8");

  assert.match(route, /unstable_cache/);
  assert.match(route, /revalidate:\s*3600/);
  assert.match(route, /s-maxage=3600/);
  assert.doesNotMatch(route, /Cache-Control[^\n]*no-store/);
  assert.match(revalidation, /revalidateTag\("google-merchant-products",\s*"max"\)/);
});

test("admin product overview uses bounded, selective pagination", () => {
  const source = readFileSync("app/admin/(dashboard)/producten/page.tsx", "utf8");

  assert.match(source, /const pageSize = 50/);
  assert.match(source, /take:\s*pageSize/);
  assert.match(source, /skip:\s*\(page - 1\) \* pageSize/);
  assert.match(source, /select:\s*\{/);
  assert.doesNotMatch(source, /images:\s*true/);
});
