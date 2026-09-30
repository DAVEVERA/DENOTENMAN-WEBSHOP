import assert from "node:assert/strict";
import test from "node:test";

import {
  COPYWRITER_ACCEPTED_REASON,
  assessCopywriterCompleteness,
} from "../lib/design-studio/copywriter/completeness";
import { copywriterProductDto } from "../lib/design-studio/copywriter/dto";
import type { CopywriterProviderOutput } from "../lib/design-studio/copywriter/schema";
import {
  buildCopywriterSourceSnapshot,
  copywriterFieldValueHash,
  type CopywriterSourceInput,
} from "../lib/design-studio/copywriter/snapshot";
import {
  CopywriterGroundingError,
  assertGroundedCopywriterProposal,
  buildGroundedCopywriterProposal,
} from "../lib/design-studio/copywriter/style";
import { exactNutrition, nutritionAttributes } from "./copywriter-nutrition-fixture";

function source(overrides: { promotionText?: string | null; salePriceCents?: number | null; seoTitle?: string } = {}): CopywriterSourceInput {
  return {
    product: {
      id: "product-1",
      sku: "CAS-ONG-250",
      slug: "cashewnoten-ongebrand",
      updatedAt: "2026-09-08T08:00:00.000Z",
      basePriceCents: 695,
      salePriceCents: overrides.salePriceCents ?? null,
      currency: "EUR",
      unit: "WEIGHT",
      isActive: true,
    },
    translation: {
      locale: "nl",
      name: "Cashewnoten ongebrand",
      slug: "cashewnoten-ongebrand",
      shortDescription: "Ongebrande cashewnoten met een zachte beet.",
      descriptionHtml: "<p>Ongebrande cashewnoten met een zachte beet, om zo te eten of door een gerecht.</p>",
      seoTitle: overrides.seoTitle ?? "Ongebrande cashewnoten | De Notenman",
      metaDescription: "Bestel ongebrande cashewnoten van De Notenman. Zacht van beet en handig als snack of door een gerecht.",
      promotionText: overrides.promotionText ?? null,
    },
    attributes: [
      { key: "allergens", value: "CASHEWNOTEN" },
      { key: "ingredients", value: "CASHEWNOTEN" },
      { key: "mayContainTraces", value: "Kan sporen bevatten van andere NOTEN." },
      ...nutritionAttributes(),
    ],
    categories: [{ id: "cat-1", slug: "noten", name: "Noten" }],
    variants: [
      { id: "variant-1", sku: "CAS-ONG-250", weightGrams: 250, preparation: "RAW", salting: "UNSALTED", coating: "NONE" },
    ],
  };
}

const editorial = (proposed: string, evidencePaths = ["translation.name"]) => ({
  proposed,
  applyAllowed: true as const,
  reason: "Maakt de informatie concreet en prettig leesbaar.",
  evidencePaths,
});

const exactFact = (proposed: string, path: string) => ({
  sourceStatus: "SOURCE_EXACT" as const,
  proposed,
  applyAllowed: true as const,
  reason: "Exact uit de geverifieerde bron.",
  evidencePaths: [path],
});

function modelOutput(): CopywriterProviderOutput {
  return {
    schemaVersion: 1,
    fields: {
      name: editorial("Ongebrande cashewnoten"),
      slug: editorial("ongebrande-cashewnoten"),
      shortDescription: editorial("Ongebrande cashewnoten met een zachte beet, om zo te eten of door een gerecht.", ["translation.shortDescription"]),
      descriptionHtml: editorial("<p>Deze ongebrande cashewnoten hebben een zachte beet. Eet ze zo of gebruik ze door een gerecht.</p>", ["translation.descriptionHtml"]),
      seoTitle: editorial("Ongebrande cashewnoten | De Notenman", ["translation.name"]),
      metaDescription: editorial("Bestel ongebrande cashewnoten van De Notenman. Zacht van beet en handig als snack of door een gerecht.", ["translation.descriptionHtml"]),
      promotionText: {
        proposed: null,
        applyAllowed: false,
        reason: "Er is geen bevestigde actieprijs.",
        evidencePaths: ["product.salePriceCents"],
      },
      ingredients: exactFact("CASHEWNOTEN", "facts.ingredients"),
      allergens: exactFact("CASHEWNOTEN", "facts.allergens"),
      mayContainTraces: exactFact("Kan sporen bevatten van andere NOTEN.", "facts.mayContainTraces"),
      ...exactNutrition(),
    },
  };
}

test("a promotion text without a sale price needs review until an admin keeps it", () => {
  const snapshot = buildCopywriterSourceSnapshot(source({ promotionText: "Nu extra voordelig" }));

  assert.equal(assessCopywriterCompleteness(snapshot).status, "NEEDS_REVIEW");

  const accepted = assessCopywriterCompleteness(snapshot, { acceptedFields: new Set(["promotionText"]) });
  assert.equal(accepted.status, "COMPLETE");
  assert.equal(accepted.fields.promotionText.status, "COMPLETE");
  assert.equal(accepted.fields.promotionText.reason, COPYWRITER_ACCEPTED_REASON);
});

test("keeping a field never hides missing text on other fields", () => {
  const snapshot = buildCopywriterSourceSnapshot(source({ promotionText: "Nu extra voordelig", seoTitle: "" }));
  const result = assessCopywriterCompleteness(snapshot, { acceptedFields: new Set(["promotionText", "seoTitle"]) });

  assert.equal(result.status, "MISSING_SEO");
  assert.equal(result.fields.seoTitle.status, "MISSING");
});

test("the product overview lists every field that needs attention and the kept fields", () => {
  const snapshot = buildCopywriterSourceSnapshot(source({ promotionText: "Nu extra voordelig", seoTitle: "" }));

  const open = copywriterProductDto(snapshot, null);
  assert.deepEqual(open.attentionFields.map((item) => [item.field, item.kind]), [
    ["seoTitle", "MISSING"],
    ["promotionText", "NEEDS_REVIEW"],
  ]);
  assert.deepEqual(open.acceptedFields, []);

  const kept = copywriterProductDto(snapshot, null, { acceptedFields: new Set(["promotionText"]) });
  assert.deepEqual(kept.attentionFields.map((item) => item.field), ["seoTitle"]);
  assert.deepEqual(kept.acceptedFields, ["promotionText"]);
});

test("a kept field expires as soon as its text changes", () => {
  const before = copywriterFieldValueHash("Nu extra voordelig");
  assert.equal(before, copywriterFieldValueHash("Nu extra voordelig"));
  assert.notEqual(before, copywriterFieldValueHash("Nu nog voordeliger"));
  assert.equal(copywriterFieldValueHash(null), copywriterFieldValueHash(""));
});

test("without a sale price the server proposes clearing a stale promotion text", () => {
  const snapshot = buildCopywriterSourceSnapshot(source({ promotionText: "Nu extra voordelig" }));
  const persisted = buildGroundedCopywriterProposal(snapshot, modelOutput());

  assert.equal(persisted.fields.promotionText.proposed, "");
  assert.equal(persisted.fields.promotionText.applyAllowed, true);
  assert.deepEqual(persisted.fields.promotionText.evidencePaths, ["product.salePriceCents"]);
});

test("promotion clearing is only proposed when there is text to clear and no sale", () => {
  const empty = buildGroundedCopywriterProposal(buildCopywriterSourceSnapshot(source()), modelOutput());
  assert.equal(empty.fields.promotionText.proposed, null);
  assert.equal(empty.fields.promotionText.applyAllowed, false);

  const notApplicable = buildGroundedCopywriterProposal(buildCopywriterSourceSnapshot(source({ promotionText: "n.v.t." })), modelOutput());
  assert.equal(notApplicable.fields.promotionText.proposed, null);
});

test("without a sale price a new promotion text is still refused", () => {
  const snapshot = buildCopywriterSourceSnapshot(source({ promotionText: "Nu extra voordelig" }));
  const output = modelOutput();
  output.fields.promotionText = editorial("Tijdelijk voordeliger", ["product.salePriceCents"]);

  assert.throws(
    () => assertGroundedCopywriterProposal(snapshot, output),
    (error) => error instanceof CopywriterGroundingError && error.code === "PROMOTION_NOT_VERIFIED",
  );
});
