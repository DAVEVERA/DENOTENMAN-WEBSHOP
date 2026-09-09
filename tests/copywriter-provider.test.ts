import assert from "node:assert/strict";
import test from "node:test";
import type { CopywriterProviderOutput } from "../lib/design-studio/copywriter/schema";
import { buildCopywriterSourceSnapshot } from "../lib/design-studio/copywriter/snapshot";
import {
  CopywriterProviderError,
  isCopywriterGeminiConfigured,
  runCopywriterGeneration,
} from "../lib/design-studio/copywriter/gemini-provider";

function snapshot() {
  return buildCopywriterSourceSnapshot({
    product: {
      id: "product-1",
      sku: "CAS-ONG-250",
      slug: "cashewnoten-ongebrand",
      updatedAt: "2026-09-08T08:00:00.000Z",
      basePriceCents: 695,
      salePriceCents: null,
      currency: "EUR",
      unit: "WEIGHT",
      isActive: true,
    },
    translation: {
      locale: "nl",
      name: "Cashewnoten ongebrand",
      slug: "cashewnoten-ongebrand",
      shortDescription: "Ongebrande cashewnoten met een zachte beet.",
      descriptionHtml:
        "<p>Ongebrande cashewnoten met een zachte beet, om zo te eten of door een gerecht.</p>",
      seoTitle: "Ongebrande cashewnoten | De Notenman",
      metaDescription:
        "Bestel ongebrande cashewnoten van De Notenman. Zacht van beet en handig als snack of door een gerecht.",
      promotionText: null,
    },
    attributes: [
      { key: "allergens", value: "CASHEWNOTEN" },
      { key: "ingredients", value: "CASHEWNOTEN" },
    ],
    categories: [{ id: "cat-1", slug: "noten", name: "Noten" }],
    variants: [
      {
        id: "variant-1",
        sku: "CAS-ONG-250",
        weightGrams: 250,
        preparation: "RAW",
        salting: "UNSALTED",
        coating: "NONE",
      },
    ],
  });
}

const editorial = (proposed: string, evidencePaths = ["translation.name"]) => ({
  proposed,
  applyAllowed: true as const,
  reason: "Concreet en prettig leesbaar.",
  evidencePaths,
});

function candidate(): CopywriterProviderOutput {
  return {
    schemaVersion: 1,
    fields: {
      name: editorial("Ongebrande cashewnoten"),
      slug: editorial("ongebrande-cashewnoten"),
      shortDescription: editorial(
        "Ongebrande cashewnoten met een zachte beet, om zo te eten of door een gerecht.",
        ["translation.shortDescription"],
      ),
      descriptionHtml: editorial(
        "<p>Deze ongebrande cashewnoten hebben een zachte beet. Eet ze zo of gebruik ze door een gerecht.</p>",
        ["translation.descriptionHtml"],
      ),
      seoTitle: editorial("Ongebrande cashewnoten | De Notenman"),
      metaDescription: editorial(
        "Bestel ongebrande cashewnoten van De Notenman. Zacht van beet en handig als snack of door een gerecht.",
        ["translation.descriptionHtml"],
      ),
      promotionText: {
        proposed: null,
        applyAllowed: false,
        reason: "Er is geen bevestigde actieprijs.",
        evidencePaths: ["product.salePriceCents"],
      },
      ingredients: {
        sourceStatus: "SOURCE_EXACT",
        proposed: "CASHEWNOTEN",
        applyAllowed: true,
        reason: "Exact uit de bron.",
        evidencePaths: ["facts.ingredients"],
      },
      allergens: {
        sourceStatus: "SOURCE_EXACT",
        proposed: "CASHEWNOTEN",
        applyAllowed: true,
        reason: "Exact uit de bron.",
        evidencePaths: ["facts.allergens"],
      },
      mayContainTraces: {
        sourceStatus: "MISSING_VERIFIED_SOURCE",
        proposed: null,
        applyAllowed: false,
        reason: "Een geverifieerde bron ontbreekt.",
        evidencePaths: ["facts.mayContainTraces"],
      },
    },
  };
}

test("CopyWriter configuration rejects missing and placeholder keys", () => {
  const previous = process.env.GEMINI_API_KEY;
  try {
    delete process.env.GEMINI_API_KEY;
    assert.equal(isCopywriterGeminiConfigured(), false);
    process.env.GEMINI_API_KEY = "MY_GEMINI_API_KEY";
    assert.equal(isCopywriterGeminiConfigured(), false);
  } finally {
    if (previous === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previous;
  }
});
test("CopyWriter fails closed without Gemini", async () => {
  const previous = process.env.GEMINI_API_KEY;
  try {
    delete process.env.GEMINI_API_KEY;
    await assert.rejects(
      () => runCopywriterGeneration(snapshot()),
      (error: unknown) =>
        error instanceof CopywriterProviderError &&
        error.code === "COPYWRITER_NOT_CONFIGURED" &&
        error.status === 503,
    );
  } finally {
    if (previous === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previous;
  }
});

test("CopyWriter validates and grounds mocked structured output", async () => {
  const previous = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-key";
  let request: unknown;
  try {
    const result = await runCopywriterGeneration(snapshot(), async (input) => {
      request = input;
      return { text: JSON.stringify(candidate()), requestId: "copy-1" };
    });
    assert.equal(result.modelId, "gemini-3.6-flash");
    assert.equal(result.providerRequestId, "copy-1");
    assert.match(JSON.stringify(request), /application\/json/);
    assert.equal(result.proposal.fields.ingredients.proposed, "CASHEWNOTEN");
    assert.equal(result.proposal.fields.mayContainTraces.applyAllowed, false);
  } finally {
    if (previous === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previous;
  }
});

test("CopyWriter rejects ungrounded or malformed provider output", async () => {
  const previous = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-key";
  try {
    const unsafe = candidate();
    unsafe.fields.ingredients = {
      sourceStatus: "SOURCE_EXACT",
      proposed: "CASHEWNOTEN, pinda",
      applyAllowed: true,
      reason: "Aangevuld.",
      evidencePaths: ["facts.ingredients"],
    };
    await assert.rejects(
      () =>
        runCopywriterGeneration(snapshot(), async () => ({
          text: JSON.stringify(unsafe),
        })),
      (error: unknown) =>
        error instanceof CopywriterProviderError &&
        error.code === "UNSAFE_PROPOSAL_REJECTED",
    );
    await assert.rejects(
      () =>
        runCopywriterGeneration(snapshot(), async () => ({ text: "not-json" })),
      (error: unknown) =>
        error instanceof CopywriterProviderError &&
        error.code === "INVALID_PROVIDER_RESPONSE",
    );
  } finally {
    if (previous === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previous;
  }
});
