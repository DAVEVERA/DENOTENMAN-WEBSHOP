import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  extractImageReferences,
  parseScanOptions,
  storefrontSitemapNames,
} from "../scripts/scan-storefront-image-urls";

test("the release image scan covers every indexable storefront page type", () => {
  assert.deepEqual(storefrontSitemapNames, ["pages", "categories", "products", "blog"]);
  assert.equal(parseScanOptions(["--base=https://example.test"]).maxPages, 20_000);
});

test("the image scan checks both a Next optimizer URL and its upstream object", () => {
  const upstream = "https://storage.googleapis.com/example/product.webp";
  const optimizer = `/_next/image?url=${encodeURIComponent(upstream)}&w=640&q=75`;
  const references = extractImageReferences(`<img src="${optimizer}">`, "https://example.test");

  assert.deepEqual(references, [
    {
      requestUrl: `https://example.test${optimizer}`,
      upstreamUrl: upstream,
      kind: "optimizer",
    },
  ]);
});

test("category story heroes do not pin replaceable product storage keys", async () => {
  const source = await readFile(
    new URL("../app/[locale]/pages/[slug]/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /export const revalidate = 60/);
  assert.doesNotMatch(source, /publicImageUrl\(/);
  assert.match(source, /tiles\.find\(\(tile\) => tile\.imageSrc\)/);
});
