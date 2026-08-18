import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeCategoryAssignments,
  productSaveErrorMessage,
} from "../components/admin-panel/ProductAdminForm";
import * as productFormModule from "../components/admin-panel/ProductAdminForm";

test("product save failures remain actionable after network and stale-write errors", () => {
  assert.equal(
    productSaveErrorMessage(new TypeError("Failed to fetch")),
    "Geen verbinding met de server. Controleer je internetverbinding en probeer opnieuw."
  );
  assert.equal(
    productSaveErrorMessage({ error: "STALE_PRODUCT" }),
    "Dit product is intussen elders gewijzigd. Herlaad de pagina voordat je opnieuw opslaat."
  );
  assert.equal(productSaveErrorMessage({ message: "SKU bestaat al." }), "SKU bestaat al.");
});

test("Zod variant issues expose the exact Dutch field instead of the generic fallback", () => {
  assert.equal(
    productSaveErrorMessage({
      error: "VALIDATION_ERROR",
      message: "Controleer het gemarkeerde veld.",
      field: "variants.2.salePriceCents",
      issues: [{
        code: "custom",
        path: ["variants", 2, "salePriceCents"],
        message: "Actieprijs moet lager zijn dan de normale prijs.",
      }],
    }),
    "Variant 3 – actieprijs: Actieprijs moet lager zijn dan de normale prijs."
  );
});

test("legacy create-route Zod errors remain actionable while that route uses flattened issues", () => {
  assert.equal(
    productSaveErrorMessage({
      error: "VALIDATION_ERROR",
      issues: {
        formErrors: [],
        fieldErrors: {
          variants: ["Variant-SKU's moeten binnen het product uniek zijn."],
        },
      },
    }),
    "Varianten: Variant-SKU's moeten binnen het product uniek zijn."
  );
});

test("known save error codes always produce actionable Dutch feedback", () => {
  const cases: Array<[unknown, string]> = [
    [
      { error: "SKU_CONFLICT", field: "sku" },
      "Deze product-SKU is al in gebruik. Kies een andere SKU.",
    ],
    [
      { error: "SLUG_CONFLICT", field: "translations.1.slug" },
      "De Engelse slug is al in gebruik. Kies een andere slug.",
    ],
    [
      { error: "CATEGORY_PARENT_REQUIRED", field: "categories" },
      "De gekozen categorie mist een bovenliggende categorie. Kies de volledige categorie-indeling opnieuw.",
    ],
    [
      { error: "RECOMMENDATION_NOT_FOUND", field: "recommendationIds" },
      "Een gekozen meepakker bestaat niet meer. Kies de meepakkers opnieuw.",
    ],
    [
      { error: "VARIANT_HAS_ORDER_HISTORY", field: "variants", variantSku: "NAT-10003-350" },
      "Variant NAT-10003-350 staat in een bestelling en kan daarom niet worden verwijderd. Zet de variant op ‘Niet bestelbaar’ om de bestelgeschiedenis te bewaren.",
    ],
    [
      { error: "INTERNAL_ERROR", requestId: "req-123" },
      "De server kon het product niet opslaan. Probeer opnieuw. Blijft dit gebeuren, meld dan foutcode req-123.",
    ],
  ];

  for (const [payload, expected] of cases) {
    assert.equal(productSaveErrorMessage(payload), expected);
  }
});

test("removing an unsaved or persisted variant removes it from the outgoing draft", () => {
  const module = productFormModule as unknown as {
    removeVariantFromDraft?: <T extends { clientKey: string; id?: string }>(variants: T[], clientKey: string) => T[];
  };
  assert.equal(typeof module.removeVariantFromDraft, "function");
  if (!module.removeVariantFromDraft) return;

  const variants = [
    { clientKey: "persisted", id: "cm12345678901234567890123", sku: "OLD" },
    { clientKey: "new", sku: "NEW" },
  ];
  assert.deepEqual(module.removeVariantFromDraft(variants, "new"), [variants[0]]);
  assert.deepEqual(module.removeVariantFromDraft(variants, "persisted"), [variants[1]]);
});

test("category assignments always expose exactly one deepest primary category", () => {
  const normalized = normalizeCategoryAssignments(
    [
      { categoryId: "main", isPrimary: false, sortOrder: 0 },
      { categoryId: "sub", isPrimary: false, sortOrder: 1 },
    ],
    [
      { id: "main", name: "Noten", parentId: null },
      { id: "sub", name: "Amandelen", parentId: "main" },
    ],
  );

  assert.deepEqual(normalized.map(({ categoryId, isPrimary }) => ({ categoryId, isPrimary })), [
    { categoryId: "main", isPrimary: false },
    { categoryId: "sub", isPrimary: true },
  ]);
});
