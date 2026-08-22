import assert from "node:assert/strict";
import test from "node:test";
import { pageKeys, pagePath, pageRobots, resolvePageKey } from "../lib/pages";
test("all requested De Notenman legal pages have stable Dutch routes", () => {
  const expected = {
    terms: "/nl/paginas/algemene-voorwaarden",
    additionalTerms: "/nl/paginas/aanvullende-voorwaarden",
    privacy: "/nl/paginas/privacybeleid",
    cookies: "/nl/paginas/cookiebeleid",
    withdrawal: "/nl/paginas/herroepingsrecht",
    processingAgreement: "/nl/paginas/verwerkersovereenkomst",
    shippingReturns: "/nl/paginas/verzenden-en-retourneren",
  } as const;

  for (const [key, path] of Object.entries(expected)) {
    assert.equal(pagePath(key as keyof typeof expected, "nl"), path);
    assert.equal(resolvePageKey("nl", path.split("/").at(-1)!), key);
    assert.ok(pageKeys.includes(key as (typeof pageKeys)[number]));
  }
});

test("the processor agreement is public to counterparties but excluded from search indexing", () => {
  assert.deepEqual(pageRobots("processingAgreement"), { index: false, follow: true });
});
