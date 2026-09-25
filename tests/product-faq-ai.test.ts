import assert from "node:assert/strict";
import test from "node:test";

import {
  assertFaqSuggestionGrounded,
  generateProductFaqSuggestions,
  ProductFaqAiError,
  ProductFaqAiGroundingError,
  type ProductFaqFactCard,
} from "../lib/product-faq-ai";

function factCard(overrides: Partial<ProductFaqFactCard> = {}): ProductFaqFactCard {
  return {
    productName: "Cashewnoten ongebrand",
    categoryName: "Noten",
    ingredients: "CASHEWNOTEN",
    allergens: "CASHEWNOTEN",
    mayContainTraces: "PINDA'S, ANDERE NOTEN",
    variants: [{ weightGrams: 250, preparation: "RAW", salting: "UNSALTED", coating: "NONE" }],
    ...overrides,
  };
}

test("allows a suggestion that never mentions allergen topics", () => {
  assert.doesNotThrow(() =>
    assertFaqSuggestionGrounded(factCard(), {
      question: "Hoe lang blijven de cashewnoten vers na opening?",
      answer: "Bewaar de zak goed gesloten op een koele, droge plek.",
    })
  );
});

test("allows an allergen claim that exactly matches the verified facts", () => {
  assert.doesNotThrow(() =>
    assertFaqSuggestionGrounded(factCard(), {
      question: "Bevat dit product allergenen?",
      answer: "Dit product bevat cashewnoten en kan sporen van pinda's bevatten.",
    })
  );
});

test("rejects an allergen claim that is not backed by the verified facts", () => {
  assert.throws(
    () =>
      assertFaqSuggestionGrounded(factCard(), {
        question: "Bevat dit product gluten?",
        answer: "Nee, dit product bevat geen gluten of lactose.",
      }),
    (error: unknown) => error instanceof ProductFaqAiGroundingError && error.code === "ALLERGEN_CLAIM_UNVERIFIED"
  );
});

test("rejects any allergen claim when no verified source exists at all", () => {
  assert.throws(
    () =>
      assertFaqSuggestionGrounded(factCard({ ingredients: null, allergens: null, mayContainTraces: null }), {
        question: "Bevat dit product noten?",
        answer: "Ja, dit product bevat noten.",
      }),
    (error: unknown) => error instanceof ProductFaqAiGroundingError && error.code === "ALLERGEN_SOURCE_MISSING"
  );
});

test("generateProductFaqSuggestions drops duplicates and hallucinated allergen claims, keeps safe suggestions", async () => {
  const suggestions = await generateProductFaqSuggestions(
    {
      factCard: factCard(),
      existingQuestions: ["Hoe lang blijven de cashewnoten vers na opening?"],
    },
    async () => ({
      text: JSON.stringify({
        suggestions: [
          { question: "Hoe lang blijven de cashewnoten vers na opening?", answer: "Duplicate van bestaande vraag." },
          { question: "Bevat dit product gluten?", answer: "Nee, geheel glutenvrij." },
          { question: "Zijn deze cashewnoten geschikt als snack?", answer: "Ja, ze zijn heerlijk als tussendoortje." },
        ],
      }),
    })
  );

  assert.deepEqual(suggestions, [
    { question: "Zijn deze cashewnoten geschikt als snack?", answer: "Ja, ze zijn heerlijk als tussendoortje." },
  ]);
});

test("generateProductFaqSuggestions sends product-specific data and the min/max guidance to the provider", async () => {
  let capturedPrompt = "";
  await generateProductFaqSuggestions(
    {
      factCard: factCard({ categoryName: "Noten", variants: [
        { weightGrams: 250, preparation: "ROASTED", salting: "SALTED", coating: "NONE" },
        { weightGrams: 500, preparation: "ROASTED", salting: "SALTED", coating: "NONE" },
      ] }),
      existingQuestions: ["Een al bestaande vraag?"],
    },
    async (request) => {
      const parts = (request.contents as Array<{ parts: Array<{ text: string }> }>)[0].parts;
      capturedPrompt = parts[1].text;
      return { text: JSON.stringify({ suggestions: [] }) };
    }
  );
  assert.match(capturedPrompt, /minimaal 3, maximaal 5/);
  assert.match(capturedPrompt, /Noten/);
  assert.match(capturedPrompt, /"gewichtGrams":250/);
  assert.match(capturedPrompt, /"gewichtGrams":500/);
  assert.match(capturedPrompt, /"bereiding":"ROASTED"/);
  assert.match(capturedPrompt, /Een al bestaande vraag\?/);
});

test("generateProductFaqSuggestions surfaces an error for an invalid provider response", async () => {
  await assert.rejects(
    () => generateProductFaqSuggestions({ factCard: factCard(), existingQuestions: [] }, async () => ({ text: "not json" })),
    (error: unknown) => error instanceof ProductFaqAiError && error.code === "FAQ_AI_INVALID_RESPONSE"
  );
});

test("generateProductFaqSuggestions caps suggestions at 5", async () => {
  const suggestions = await generateProductFaqSuggestions(
    { factCard: factCard(), existingQuestions: [] },
    async () => ({
      text: JSON.stringify({
        suggestions: Array.from({ length: 5 }, (_, index) => ({
          question: `Vraag ${index}?`,
          answer: `Antwoord ${index}.`,
        })),
      }),
    })
  );
  assert.equal(suggestions.length, 5);
});
