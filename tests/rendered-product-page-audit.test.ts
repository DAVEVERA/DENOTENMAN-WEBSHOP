import assert from "node:assert/strict";
import test from "node:test";
import * as auditCore from "../lib/product-audit-core";
import * as renderedAuditModule from "../lib/rendered-product-page-audit";
import * as productAuditModule from "../lib/product-audit";

type RenderAudit = {
  score: number;
  checks: Array<{ code: string; passed: boolean }>;
};

type AuditRenderedHtml = (input: {
  locale: "nl" | "en" | "fr";
  url: string;
  status: number;
  html: string;
  productName: string;
}) => RenderAudit;

const module = auditCore as unknown as { auditRenderedProductPageHtml?: AuditRenderedHtml };

test("rendered page audit validates indexability, metadata and Product structured data", () => {
  assert.equal(typeof module.auditRenderedProductPageHtml, "function");
  if (!module.auditRenderedProductPageHtml) return;

  const result = module.auditRenderedProductPageHtml({
    locale: "nl",
    url: "https://denotenman.com/nl/producten/amandelen",
    status: 200,
    productName: "Amandelen",
    html: `<!doctype html><html lang="nl"><head>
      <title>Amandelen</title>
      <meta name="description" content="Knapperige amandelen met een volle smaak.">
      <meta name="robots" content="index,follow">
      <link rel="canonical" href="/nl/producten/amandelen">
      <link rel="alternate" hreflang="nl" href="/nl/producten/amandelen">
      <link rel="alternate" hreflang="en" href="/en/products/almonds">
      <link rel="alternate" hreflang="fr" href="/fr/produits/amandes">
      <script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Amandelen"}</script>
    </head><body><main><h1>Amandelen</h1></main></body></html>`,
  });

  assert.equal(result.score, 100);
  assert.equal(result.checks.every((check) => check.passed), true);
});

test("rendered page audit reports missing SEO signals and noindex", () => {
  assert.equal(typeof module.auditRenderedProductPageHtml, "function");
  if (!module.auditRenderedProductPageHtml) return;

  const result = module.auditRenderedProductPageHtml({
    locale: "fr",
    url: "https://denotenman.com/fr/produits/amandes",
    status: 404,
    productName: "Amandes",
    html: '<html lang="fr"><head><meta name="robots" content="noindex"></head><body><h2>Amandes</h2></body></html>',
  });

  const failed = new Set(result.checks.filter((check) => !check.passed).map((check) => check.code));
  assert.ok(failed.has("http-status"));
  assert.ok(failed.has("title"));
  assert.ok(failed.has("meta-description"));
  assert.ok(failed.has("canonical"));
  assert.ok(failed.has("hreflang"));
  assert.ok(failed.has("robots"));
  assert.ok(failed.has("h1"));
  assert.ok(failed.has("product-jsonld"));
  assert.equal(result.score, 0);
});

test("rendered page audit fetches every localized storefront URL and degrades safely", async () => {
  const module = renderedAuditModule as unknown as {
    auditRenderedProductPages?: (
      pages: Array<{ locale: "nl" | "en" | "fr"; path: string; productName: string }>,
      options: { baseUrl: string; fetcher: typeof fetch }
    ) => Promise<Array<RenderAudit & { locale: string; status: number }>>;
  };
  assert.equal(typeof module.auditRenderedProductPages, "function");
  if (!module.auditRenderedProductPages) return;

  const requested: string[] = [];
  const fetcher: typeof fetch = async (input) => {
    requested.push(String(input));
    if (String(input).includes("/fr/")) throw new Error("network unavailable");
    return new Response(`<!doctype html><html><head><title>Amandelen</title><meta name="description" content="Een volledige omschrijving voor de audit."><link rel="canonical" href="/nl/producten/amandelen"><link rel="alternate" hreflang="nl" href="/"><link rel="alternate" hreflang="en" href="/"><link rel="alternate" hreflang="fr" href="/"><script type="application/ld+json">{"@type":"Product"}</script></head><body><h1>Amandelen</h1></body></html>`, { status: 200 });
  };
  const pages = await module.auditRenderedProductPages(
    [
      { locale: "nl", path: "/nl/producten/amandelen", productName: "Amandelen" },
      { locale: "fr", path: "/fr/produits/amandes", productName: "Amandes" },
    ],
    { baseUrl: "https://denotenman.com", fetcher }
  );

  assert.deepEqual(requested, [
    "https://denotenman.com/nl/producten/amandelen",
    "https://denotenman.com/fr/produits/amandes",
  ]);
  assert.equal(pages[0]?.status, 200);
  assert.equal(pages[1]?.status, 0);
  assert.equal(pages[1]?.score, 0);
});

test("full product audit targets the localized storefront route for every available translation", () => {
  const module = productAuditModule as unknown as {
    buildRenderedProductPageTargets?: (translations: Array<{ locale: "nl" | "en" | "fr"; slug: string; name: string }>) => Array<{ locale: string; path: string; productName: string }>;
  };
  assert.equal(typeof module.buildRenderedProductPageTargets, "function");
  if (!module.buildRenderedProductPageTargets) return;

  assert.deepEqual(module.buildRenderedProductPageTargets([
    { locale: "nl", slug: "amandelen", name: "Amandelen" },
    { locale: "en", slug: "almonds", name: "Almonds" },
    { locale: "fr", slug: "amandes", name: "Amandes" },
  ]), [
    { locale: "nl", path: "/nl/producten/amandelen", productName: "Amandelen" },
    { locale: "en", path: "/en/products/almonds", productName: "Almonds" },
    { locale: "fr", path: "/fr/produits/amandes", productName: "Amandes" },
  ]);
});
