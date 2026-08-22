import assert from "node:assert/strict";
import test from "node:test";
import { pageKeys, pagePath, pageRobots, resolvePageKey } from "../lib/pages";
import { LEGAL_IDENTITY, LEGAL_REVIEW_REQUIRED } from "../lib/legal";
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

test("all legal pages share the supplied De Notenman registration identity", () => {
  assert.equal(LEGAL_IDENTITY.tradeName, "De Notenman");
  assert.equal(LEGAL_IDENTITY.attention, "Fedor");
  assert.equal(LEGAL_IDENTITY.address, "Oude Baan 7a, 5076 PJ Haaren");
  assert.equal(LEGAL_IDENTITY.registrationNumber, "75797003");
  assert.equal(LEGAL_IDENTITY.establishmentNumber, "000043648762");
  assert.deepEqual(
    LEGAL_IDENTITY.sbiRegistrations.map(({ code }) => code),
    ["47279", "47210"]
  );
  assert.equal(LEGAL_IDENTITY.email, "info@denotenman.com");
  assert.equal(LEGAL_IDENTITY.vatIdentificationNumber, null);
  assert.deepEqual(LEGAL_REVIEW_REQUIRED, ["btw-identificatienummer"]);
});

test("the processor agreement is public to counterparties but excluded from search indexing", () => {
  assert.deepEqual(pageRobots("processingAgreement"), { index: false, follow: true });
});
