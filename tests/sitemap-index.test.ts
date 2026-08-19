import assert from "node:assert/strict";
import test from "node:test";
import { buildSitemapIndexXml } from "../lib/sitemap-index";

test("sitemap index is UTF-8 XML, styled, escaped and uses accurate ISO dates", () => {
  const xml = buildSitemapIndexXml([
    {
      url: "https://shop.example/products/sitemap.xml?scope=nuts&lang=nl",
      lastModified: new Date("2026-08-19T10:30:00.000Z"),
    },
    { url: "https://shop.example/categories/sitemap.xml" },
  ]);

  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<\?xml-stylesheet type="text\/xsl" href="\/sitemap\.xsl"\?>/);
  assert.match(xml, /<sitemapindex xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.match(
    xml,
    /<loc>https:\/\/shop\.example\/products\/sitemap\.xml\?scope=nuts&amp;lang=nl<\/loc>/
  );
  assert.match(xml, /<lastmod>2026-08-19T10:30:00\.000Z<\/lastmod>/);
  assert.equal((xml.match(/<sitemap>/g) ?? []).length, 2);
});

test("sitemap index rejects invalid lastmod values instead of publishing bad XML", () => {
  assert.throws(
    () => buildSitemapIndexXml([{
      url: "https://shop.example/products/sitemap.xml",
      lastModified: "not-a-date",
    }]),
    /Invalid sitemap lastModified value/
  );
});
