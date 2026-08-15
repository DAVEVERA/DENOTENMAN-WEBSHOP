import assert from "node:assert/strict";
import {
  AuditConflictError,
  buildDeterministicProductAudit,
  generateStructuredProductProposals,
  prepareAuditProposalApplication,
  type ProductAuditAiBoundary,
  type ProductAuditSnapshot,
} from "../lib/product-audit-core";
import { createOpenAIProductAuditBoundary, ProductAuditOpenAIError } from "../lib/product-audit-openai";

function snapshot(): ProductAuditSnapshot {
  return {
    id: "product-1",
    sku: "NOTEN-250",
    slug: "geroosterde-amandelen",
    basePriceCents: 795,
    salePriceCents: null,
    currency: "EUR",
    unit: "WEIGHT",
    isActive: true,
    translations: [
      {
        locale: "nl",
        name: "Geroosterde amandelen",
        slug: "geroosterde-amandelen",
        shortDescription: "Knapperige geroosterde amandelen met een volle, pure smaak voor ieder genietmoment.",
        description: "Deze geroosterde amandelen hebben een stevige beet en een volle notensmaak. Lekker bij de borrel, als tussendoortje of als knapperige toevoeging aan een salade.",
        descriptionHtml: "<p>Deze geroosterde amandelen hebben een stevige beet en een volle notensmaak.</p><p>Lekker bij de borrel, als tussendoortje of als knapperige toevoeging aan een salade.</p>",
        seoTitle: "Geroosterde amandelen kopen | De Notenman",
        metaDescription: "Bestel knapperige geroosterde amandelen met een volle notensmaak eenvoudig online bij De Notenman.",
        promotionText: null,
      },
      {
        locale: "en",
        name: "Roasted almonds",
        slug: "roasted-almonds",
        shortDescription: "Knapperige geroosterde amandelen met een volle, pure smaak voor ieder genietmoment.",
        description: "These roasted almonds have a crisp bite and a full nutty flavour. Enjoy them with drinks, as a snack or in a salad.",
        descriptionHtml: "<p>These roasted almonds have a crisp bite and a full nutty flavour.</p><p>Enjoy them with drinks, as a snack or in a salad.</p>",
        seoTitle: "Buy roasted almonds | De Notenman",
        metaDescription: "Order crisp roasted almonds with a full nutty flavour online from De Notenman.",
        promotionText: null,
      },
    ],
    images: [
      { id: "image-1", alt: "Geroosterde amandelen in een schaaltje", sortOrder: 0, isPrimary: true },
    ],
    variants: [
      {
        id: "variant-1",
        sku: "NOTEN-250-A",
        priceCents: 795,
        salePriceCents: null,
        stock: 12,
        weightGrams: 250,
        preparation: "ROASTED",
        salting: "UNSALTED",
        coating: "NONE",
        isActive: true,
      },
    ],
    categories: [
      { id: "category-1", slug: "noten", name: "Noten", parentId: null, isPrimary: true, sortOrder: 1 },
    ],
    recommendations: [
      { targetProductId: "recommendation-1", sortOrder: 0 },
      { targetProductId: "recommendation-2", sortOrder: 1 },
      { targetProductId: "recommendation-3", sortOrder: 2 },
    ],
    attributes: [
      { key: "nutrition.energyKj", value: "2470" },
      { key: "nutrition.energyKcal", value: "590" },
      { key: "nutrition.fat", value: "52" },
      { key: "nutrition.saturatedFat", value: "4" },
      { key: "nutrition.carbohydrates", value: "10" },
      { key: "nutrition.sugars", value: "4.5" },
      { key: "nutrition.fiber", value: "11" },
      { key: "nutrition.protein", value: "21" },
      { key: "nutrition.salt", value: "0.01" },
    ],
  };
}

async function testDeterministicAuditCatchesTranslationAndLanguageBreaks() {
  const audit = buildDeterministicProductAudit(snapshot());

  assert.equal(audit.translationStatus.find((item) => item.locale === "nl")?.status, "complete");
  assert.equal(audit.translationStatus.find((item) => item.locale === "en")?.status, "copied_from_nl");
  assert.equal(audit.translationStatus.find((item) => item.locale === "fr")?.status, "missing");
  assert.ok(audit.issues.some((issue) => issue.code === "translation-en-copied"));
  assert.ok(audit.issues.some((issue) => issue.code === "translation-fr-missing"));
  assert.ok(audit.scores.overall >= 0 && audit.scores.overall <= 100);
  assert.ok(audit.scores.seo >= 0 && audit.scores.seo <= 100);
  assert.equal(audit.protectedFactsHash.startsWith("sha256:"), true);
  assert.equal(audit.translationStatus.every((item) => item.sourceHash.startsWith("sha256:")), true);
}

async function testHashesProtectTheRightBoundaries() {
  const original = buildDeterministicProductAudit(snapshot());
  const changedCopy = snapshot();
  changedCopy.translations[0] = { ...changedCopy.translations[0], shortDescription: "Een bewust gewijzigde Nederlandse omschrijving met voldoende lengte voor deze test." };
  const copyAudit = buildDeterministicProductAudit(changedCopy);
  const changedFacts = snapshot();
  changedFacts.variants[0] = { ...changedFacts.variants[0], stock: 99 };
  const factsAudit = buildDeterministicProductAudit(changedFacts);

  assert.equal(copyAudit.protectedFactsHash, original.protectedFactsHash, "copy edits must not change the protected-facts hash");
  assert.notEqual(
    copyAudit.translationStatus.find((item) => item.locale === "nl")?.sourceHash,
    original.translationStatus.find((item) => item.locale === "nl")?.sourceHash,
    "copy edits must invalidate that locale proposal"
  );
  assert.notEqual(factsAudit.protectedFactsHash, original.protectedFactsHash, "stock changes must invalidate every proposal");
}

async function testStructuredProposalUsesBoundaryAndNeverExposesProtectedMutationFields() {
  let received: Parameters<ProductAuditAiBoundary["generateStructured"]>[0] | undefined;
  const fake: ProductAuditAiBoundary = {
    model: "boundary-fake",
    async generateStructured(input) {
      received = input;
      return {
        overallRecommendations: ["Maak de koopinformatie per taal concreet en natuurlijk."],
        proposals: (["nl", "en", "fr"] as const).map((locale) => ({
          locale,
          shortDescription: `${locale.toUpperCase()} korte omschrijving met smaak, textuur en gebruiksmoment in natuurlijke taal.`,
          fullDescriptionHtml: `<p>${locale.toUpperCase()} volledige omschrijving met een concrete smaak en textuur.</p><script>alert('xss')</script><p>Geschikt als snack en bij de borrel.</p>`,
          seoTitle: `${locale.toUpperCase()} geroosterde amandelen kopen | De Notenman`,
          metaDescription: `${locale.toUpperCase()} bestel geroosterde amandelen met een volle smaak en knapperige beet eenvoudig online bij De Notenman.`,
          rationale: ["Sluit aan op de aanwezige productnaam en gebruiksmomenten."],
          languageFindings: [],
          evidencePaths: [`translations.${locale}.name`, "categories.0.name"],
        })),
      };
    },
  };

  const result = await generateStructuredProductProposals(snapshot(), fake);

  assert.equal(received?.task, "product-content-audit");
  assert.deepEqual(result.proposals.map((proposal) => proposal.locale), ["nl", "en", "fr"]);
  assert.equal(result.proposals[0]?.fullDescriptionHtml.includes("<script"), false, "AI HTML must be sanitized before review");
  assert.equal(result.proposals[0]?.sourceHash.startsWith("sha256:"), true, "source hashes are attached by trusted code");
  for (const proposal of result.proposals) {
    assert.equal("sku" in proposal, false);
    assert.equal("priceCents" in proposal, false);
    assert.equal("stock" in proposal, false);
    assert.equal("nutrition" in proposal, false);
    assert.equal("categoryIds" in proposal, false);
  }
}

async function testReviewApplyRejectsStaleAndOnlyReturnsEditorialUpdates() {
  const current = snapshot();
  const audit = buildDeterministicProductAudit(current);
  const nlHash = audit.translationStatus.find((item) => item.locale === "nl")?.sourceHash;
  assert.ok(nlHash);
  const request = {
    protectedFactsHash: audit.protectedFactsHash,
    proposals: [{
      locale: "nl" as const,
      sourceHash: nlHash,
      shortDescription: "Een nieuwe korte omschrijving met een volle smaak, stevige beet en helder gebruiksmoment.",
      fullDescriptionHtml: "<p>Een nieuwe volledige omschrijving met smaak, textuur en een passend serveermoment.</p><p>Zonder onbewezen claims.</p>",
      seoTitle: "Geroosterde amandelen kopen | De Notenman",
      metaDescription: "Bestel geroosterde amandelen met een volle notensmaak en stevige beet eenvoudig online bij De Notenman.",
    }],
  };

  const application = prepareAuditProposalApplication(current, request);
  assert.deepEqual(Object.keys(application.updates[0] ?? {}).sort(), [
    "description",
    "descriptionHtml",
    "locale",
    "metaDescription",
    "seoTitle",
    "shortDescription",
  ]);

  const stale = snapshot();
  stale.translations[0] = { ...stale.translations[0], descriptionHtml: "<p>Intussen door een beheerder gewijzigd.</p>" };
  assert.throws(
    () => prepareAuditProposalApplication(stale, request),
    (error: unknown) => error instanceof AuditConflictError && error.code === "STALE_TRANSLATION"
  );

  const changedFacts = snapshot();
  changedFacts.basePriceCents = 999;
  assert.throws(
    () => prepareAuditProposalApplication(changedFacts, request),
    (error: unknown) => error instanceof AuditConflictError && error.code === "STALE_PROTECTED_FACTS"
  );
}

async function testMissingOpenAIKeyFailsClearlyWithoutNetworkCall() {
  let fetched = false;
  const boundary = createOpenAIProductAuditBoundary({
    apiKey: "",
    fetchImpl: async () => {
      fetched = true;
      return new Response();
    },
  });

  await assert.rejects(
    () => boundary.generateStructured({ task: "product-content-audit", system: "test", prompt: "{}", schema: {} }),
    (error: unknown) => error instanceof Error && error.message === "OPENAI_API_KEY_MISSING"
  );
  assert.equal(fetched, false, "missing credentials must fail before an outbound request");
}

async function testOpenAIBoundarySendsStrictSchemaAndParsesResponsesOutput() {
  let requestBody: Record<string, unknown> | undefined;
  const boundary = createOpenAIProductAuditBoundary({
    apiKey: "test-key-never-sent",
    model: "test-model",
    fetchImpl: async (_input, init) => {
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return Response.json({
        output: [{
          content: [{
            type: "output_text",
            text: JSON.stringify({ proposals: [], overallRecommendations: [] }),
          }],
        }],
      }, { headers: { "x-request-id": "request-test" } });
    },
  });
  const schema = { type: "object", additionalProperties: false };
  const result = await boundary.generateStructured({
    task: "product-content-audit",
    system: "System rule",
    prompt: "{\"source\":\"data\"}",
    schema,
  });

  assert.deepEqual(result, { proposals: [], overallRecommendations: [] });
  assert.equal(requestBody?.model, "test-model");
  assert.equal(requestBody?.instructions, "System rule");
  assert.equal(requestBody?.input, "{\"source\":\"data\"}");
  assert.deepEqual(requestBody?.text, {
    format: {
      type: "json_schema",
      name: "product_content_audit",
      strict: true,
      schema,
    },
  });
}

async function testOpenAIBoundaryDistinguishesExhaustedCreditsFromRateLimiting() {
  const boundary = createOpenAIProductAuditBoundary({
    apiKey: "test-key-never-sent",
    fetchImpl: async () => Response.json(
      { error: { code: "credit_balance_exhausted", message: "No credits" } },
      { status: 429 }
    ),
  });

  await assert.rejects(
    () => boundary.generateStructured({ task: "product-content-audit", system: "test", prompt: "{}", schema: {} }),
    (error: unknown) => error instanceof ProductAuditOpenAIError
      && error.code === "OPENAI_CREDITS_EXHAUSTED"
      && error.status === 402
  );
}

async function testStructuredProposalRejectsProtectedMutationFields() {
  const fake: ProductAuditAiBoundary = {
    model: "boundary-fake",
    async generateStructured() {
      return {
        overallRecommendations: ["Gebruik concrete en feitelijke koopinformatie."],
        proposals: (["nl", "en", "fr"] as const).map((locale) => ({
          locale,
          shortDescription: locale.toUpperCase() + " korte omschrijving met voldoende concrete informatie voor de klant.",
          fullDescriptionHtml: "<p>" + locale.toUpperCase() + " volledige omschrijving met voldoende concrete smaak, textuur en gebruiksinformatie.</p>",
          seoTitle: locale.toUpperCase() + " product kopen bij De Notenman",
          metaDescription: locale.toUpperCase() + " bestel dit product met concrete smaak- en textuurinformatie eenvoudig online bij De Notenman.",
          rationale: ["Feitelijk voorstel."],
          languageFindings: [],
          evidencePaths: ["translations." + locale + ".name"],
          stock: 0,
        })),
      };
    },
  };

  await assert.rejects(
    () => generateStructuredProductProposals(snapshot(), fake),
    (error: unknown) => error instanceof Error && error.name === "ZodError"
  );
}

async function main() {
  await testDeterministicAuditCatchesTranslationAndLanguageBreaks();
  await testHashesProtectTheRightBoundaries();
  await testStructuredProposalUsesBoundaryAndNeverExposesProtectedMutationFields();
  await testReviewApplyRejectsStaleAndOnlyReturnsEditorialUpdates();
  await testMissingOpenAIKeyFailsClearlyWithoutNetworkCall();
  await testOpenAIBoundarySendsStrictSchemaAndParsesResponsesOutput();
  await testOpenAIBoundaryDistinguishesExhaustedCreditsFromRateLimiting();
  await testStructuredProposalRejectsProtectedMutationFields();
  console.log("product audit tests: ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
