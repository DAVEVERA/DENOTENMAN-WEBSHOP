import assert from "node:assert/strict";
import test from "node:test";
import { auditRenderedProductPageHtml } from "../lib/rendered-product-page-audit";

const input = {
  locale: "nl" as const,
  url: "https://denotenman.com/nl/producten/test",
  status: 200,
  productName: "Test Amandelen",
};

test("detects readable product description in initial HTML body", () => {
  const html = `<html><head><title>Test Amandelen</title></head><body>
    <h1>Test Amandelen</h1>
    <p>Deze knapperige amandelen zijn geschikt voor een borrelplank en kunnen ook worden gebruikt als topping bij verschillende gerechten.</p>
  </body></html>`;
  const audit = auditRenderedProductPageHtml({ ...input, html });
  assert.equal(audit.checks.find((check) => check.code === "visible-description")?.passed, true);
});

test("does not mistake JSON-LD or head metadata for visible description", () => {
  const html = `<html><head><meta name="description" content="Zeer uitgebreid product met geweldige smaken en veel eigenschappen voor uw borrelplank.">
    <script type="application/ld+json">{"@type":"Product","description":"Een lange beschrijving die niet in de body staat."}</script>
  </head><body><h1>Test Amandelen</h1><button>Bestellen</button></body></html>`;
  const audit = auditRenderedProductPageHtml({ ...input, html });
  assert.equal(audit.checks.find((check) => check.code === "visible-description")?.passed, false);
});

test("reports missing description on unreachable product page", () => {
  const audit = auditRenderedProductPageHtml({ ...input, status: 0, html: "" });
  assert.equal(audit.checks.find((check) => check.code === "visible-description")?.passed, false);
});
