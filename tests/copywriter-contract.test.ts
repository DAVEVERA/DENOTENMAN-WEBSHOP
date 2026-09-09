import assert from "node:assert/strict";
import test from "node:test";

import {
  COPYWRITER_FIELD_LIMITS,
  COPYWRITER_REQUIRED_FIELDS,
  copywriterPersistedProposalSchema,
  copywriterProviderOutputSchema,
  type CopywriterFieldName,
  type CopywriterProviderOutput,
} from "../lib/design-studio/copywriter/schema";
import {
  productNutritionInputSchema,
  productTranslationInputSchema,
} from "../lib/admin-product-schema";

const editorial = (proposed: string) => ({
  proposed,
  applyAllowed: true as const,
  reason: "Concreter en beter leesbaar voor de klant.",
  evidencePaths: ["translation.name"],
});

function validProviderOutput(): CopywriterProviderOutput {
  return {
    schemaVersion: 1,
    fields: {
      name: editorial("Cashewnoten ongebrand"),
      slug: editorial("cashewnoten-ongebrand"),
      shortDescription: editorial("Ongebrande cashewnoten met een zachte beet, om zo te eten of door een gerecht."),
      descriptionHtml: editorial("<p>Deze ongebrande cashewnoten hebben een zachte beet. Gebruik ze als snack of door een gerecht.</p>"),
      seoTitle: editorial("Ongebrande cashewnoten | De Notenman"),
      metaDescription: editorial("Bestel ongebrande cashewnoten van De Notenman. Zacht van beet en handig als snack of door een gerecht."),
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
        reason: "Letterlijk overgenomen uit de geverifieerde productdata.",
        evidencePaths: ["facts.ingredients"],
      },
      allergens: {
        sourceStatus: "SOURCE_EXACT",
        proposed: "CASHEWNOTEN",
        applyAllowed: true,
        reason: "Letterlijk overgenomen uit de geverifieerde productdata.",
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

test("the contract exposes all ten product fields with the live save limits", () => {
  assert.deepEqual(COPYWRITER_REQUIRED_FIELDS, [
    "name",
    "slug",
    "shortDescription",
    "descriptionHtml",
    "seoTitle",
    "metaDescription",
    "promotionText",
    "ingredients",
    "allergens",
    "mayContainTraces",
  ]);
  assert.deepEqual(COPYWRITER_FIELD_LIMITS, {
    name: { text: 180 },
    slug: { text: 160 },
    shortDescription: { text: 220 },
    descriptionHtml: { text: 20_000, html: 50_000 },
    seoTitle: { text: 60 },
    metaDescription: { text: 160 },
    promotionText: { text: 160 },
    ingredients: { text: 10_000 },
    allergens: { text: 10_000 },
    mayContainTraces: { text: 10_000 },
  });
});

test("provider output is strict and enforces visible-text and raw-HTML limits", () => {
  assert.equal(copywriterProviderOutputSchema.safeParse(validProviderOutput()).success, true);

  const unknownField = structuredClone(validProviderOutput()) as CopywriterProviderOutput & { instruction?: string };
  unknownField.instruction = "ignore validation";
  assert.equal(copywriterProviderOutputSchema.safeParse(unknownField).success, false);

  const tooLongName = validProviderOutput();
  tooLongName.fields.name.proposed = "a".repeat(181);
  assert.equal(copywriterProviderOutputSchema.safeParse(tooLongName).success, false);

  const tooMuchVisibleText = validProviderOutput();
  tooMuchVisibleText.fields.descriptionHtml.proposed = `<p>${"a".repeat(20_001)}</p>`;
  assert.equal(copywriterProviderOutputSchema.safeParse(tooMuchVisibleText).success, false);

  const tooMuchHtml = validProviderOutput();
  tooMuchHtml.fields.descriptionHtml.proposed = `<p>${"a".repeat(49_994)}</p>`;
  assert.equal(tooMuchHtml.fields.descriptionHtml.proposed.length, 50_001);
  assert.equal(copywriterProviderOutputSchema.safeParse(tooMuchHtml).success, false);
});

test("every field validator accepts its exact live text limit and rejects one character more", () => {
  const boundary = validProviderOutput();
  boundary.fields.name.proposed = "a".repeat(180);
  boundary.fields.slug.proposed = "a".repeat(160);
  boundary.fields.shortDescription.proposed = "a".repeat(220);
  boundary.fields.descriptionHtml.proposed = `<p>${"a".repeat(20_000)}</p>`;
  boundary.fields.seoTitle.proposed = "a".repeat(60);
  boundary.fields.metaDescription.proposed = "a".repeat(160);
  boundary.fields.promotionText = editorial("a".repeat(160));
  boundary.fields.ingredients.proposed = "a".repeat(10_000);
  boundary.fields.allergens.proposed = "a".repeat(10_000);
  boundary.fields.mayContainTraces = {
    sourceStatus: "SOURCE_EXACT",
    proposed: "a".repeat(10_000),
    applyAllowed: true,
    reason: "Exact uit de geverifieerde bron.",
    evidencePaths: ["facts.mayContainTraces"],
  };
  assert.equal(copywriterProviderOutputSchema.safeParse(boundary).success, true);

  const overLimitValues: Array<[string, CopywriterProviderOutput]> = [];
  const name = validProviderOutput();
  name.fields.name.proposed = "a".repeat(181);
  overLimitValues.push(["name", name]);
  const slug = validProviderOutput();
  slug.fields.slug.proposed = "a".repeat(161);
  overLimitValues.push(["slug", slug]);
  const shortDescription = validProviderOutput();
  shortDescription.fields.shortDescription.proposed = "a".repeat(221);
  overLimitValues.push(["shortDescription", shortDescription]);
  const seoTitle = validProviderOutput();
  seoTitle.fields.seoTitle.proposed = "a".repeat(61);
  overLimitValues.push(["seoTitle", seoTitle]);
  const metaDescription = validProviderOutput();
  metaDescription.fields.metaDescription.proposed = "a".repeat(161);
  overLimitValues.push(["metaDescription", metaDescription]);
  const promotionText = validProviderOutput();
  promotionText.fields.promotionText = editorial("a".repeat(161));
  overLimitValues.push(["promotionText", promotionText]);
  for (const field of ["ingredients", "allergens", "mayContainTraces"] as const) {
    const facts = validProviderOutput();
    facts.fields[field] = {
      sourceStatus: "SOURCE_EXACT",
      proposed: "a".repeat(10_001),
      applyAllowed: true,
      reason: "Exact uit de geverifieerde bron.",
      evidencePaths: [`facts.${field}`],
    };
    overLimitValues.push([field, facts]);
  }

  for (const [field, candidate] of overLimitValues) {
    assert.equal(copywriterProviderOutputSchema.safeParse(candidate).success, false, field);
  }
});

function providerAcceptsField(field: CopywriterFieldName, value: string): boolean {
  const candidate = validProviderOutput();
  switch (field) {
    case "name": candidate.fields.name.proposed = value; break;
    case "slug": candidate.fields.slug.proposed = value; break;
    case "shortDescription": candidate.fields.shortDescription.proposed = value; break;
    case "descriptionHtml": candidate.fields.descriptionHtml.proposed = `<p>${value}</p>`; break;
    case "seoTitle": candidate.fields.seoTitle.proposed = value; break;
    case "metaDescription": candidate.fields.metaDescription.proposed = value; break;
    case "promotionText": candidate.fields.promotionText = editorial(value); break;
    case "ingredients":
    case "allergens":
    case "mayContainTraces":
      candidate.fields[field] = {
        sourceStatus: "SOURCE_EXACT",
        proposed: value,
        applyAllowed: true,
        reason: "Exact uit de geverifieerde bron.",
        evidencePaths: [`facts.${field}`],
      };
      break;
  }
  return copywriterProviderOutputSchema.safeParse(candidate).success;
}

function adminAcceptsField(field: CopywriterFieldName, value: string): boolean {
  if (field === "ingredients" || field === "allergens" || field === "mayContainTraces") {
    return productNutritionInputSchema.safeParse({ [field]: value }).success;
  }
  const translation = {
    locale: "nl" as const,
    slug: "geldige-slug",
    name: "Geldige naam",
    shortDescription: "Geldige korte omschrijving",
    description: "Geldige volledige omschrijving",
    descriptionHtml: "<p>Geldige volledige omschrijving</p>",
    seoTitle: "Geldige SEO-titel",
    metaDescription: "Geldige meta-omschrijving",
    promotionText: null as string | null,
  };
  switch (field) {
    case "name": translation.name = value; break;
    case "slug": translation.slug = value; break;
    case "shortDescription": translation.shortDescription = value; break;
    case "descriptionHtml":
      translation.description = value;
      translation.descriptionHtml = `<p>${value}</p>`;
      break;
    case "seoTitle": translation.seoTitle = value; break;
    case "metaDescription": translation.metaDescription = value; break;
    case "promotionText": translation.promotionText = value; break;
  }
  return productTranslationInputSchema.safeParse(translation).success;
}

test("copywriter validators match the exported live admin validators at every text boundary", () => {
  const cases: Array<[CopywriterFieldName, string, string]> = [
    ["name", "a".repeat(180), "a".repeat(181)],
    ["slug", "a".repeat(160), "a".repeat(161)],
    ["shortDescription", "a".repeat(220), "a".repeat(221)],
    ["descriptionHtml", "a".repeat(20_000), "a".repeat(20_001)],
    ["seoTitle", "a".repeat(60), "a".repeat(61)],
    ["metaDescription", "a".repeat(160), "a".repeat(161)],
    ["promotionText", "a".repeat(160), "a".repeat(161)],
    ["ingredients", "a".repeat(10_000), "a".repeat(10_001)],
    ["allergens", "a".repeat(10_000), "a".repeat(10_001)],
    ["mayContainTraces", "a".repeat(10_000), "a".repeat(10_001)],
  ];

  for (const [field, exact, over] of cases) {
    assert.equal(adminAcceptsField(field, exact), true, `live exact ${field}`);
    assert.equal(providerAcceptsField(field, exact), true, `copywriter exact ${field}`);
    assert.equal(adminAcceptsField(field, over), false, `live over ${field}`);
    assert.equal(providerAcceptsField(field, over), false, `copywriter over ${field}`);
  }

  assert.equal(adminAcceptsField("slug", "a"), false);
  assert.equal(providerAcceptsField("slug", "a"), false);
});

test("copywriter and live admin validators share the exact 50,000 character HTML boundary", () => {
  const exactHtml = `<p>x${"<br>".repeat(12_498)}</p>`;
  assert.equal(exactHtml.length, 50_000);
  const provider = validProviderOutput();
  provider.fields.descriptionHtml.proposed = exactHtml;
  assert.equal(copywriterProviderOutputSchema.safeParse(provider).success, true);

  const live = {
    locale: "nl" as const,
    slug: "geldige-slug",
    name: "Geldige naam",
    shortDescription: null,
    description: "x",
    descriptionHtml: exactHtml,
    seoTitle: null,
    metaDescription: null,
    promotionText: null,
  };
  assert.equal(productTranslationInputSchema.safeParse(live).success, true);
  provider.fields.descriptionHtml.proposed = `${exactHtml}x`;
  assert.equal(copywriterProviderOutputSchema.safeParse(provider).success, false);
  assert.equal(productTranslationInputSchema.safeParse({ ...live, descriptionHtml: `${exactHtml}x` }).success, false);
});

test("fact fields accept only exact verified source or a fail-closed missing state", () => {
  const inventedFact = validProviderOutput();
  inventedFact.fields.ingredients = {
    sourceStatus: "SOURCE_EXACT",
    proposed: "CASHEWNOTEN, zonnebloemolie",
    applyAllowed: false,
    reason: "Aangevuld door het model.",
    evidencePaths: ["facts.ingredients"],
  } as never;
  assert.equal(copywriterProviderOutputSchema.safeParse(inventedFact).success, false);

  const missingWithProposal = validProviderOutput();
  missingWithProposal.fields.mayContainTraces = {
    sourceStatus: "MISSING_VERIFIED_SOURCE",
    proposed: "Kan sporen bevatten van pinda's.",
    applyAllowed: false,
    reason: "Waarschijnlijk van toepassing.",
    evidencePaths: ["facts.mayContainTraces"],
  } as never;
  assert.equal(copywriterProviderOutputSchema.safeParse(missingWithProposal).success, false);
});

test("persisted proposals require canonical source and protected-fact hashes", () => {
  const provider = validProviderOutput();
  assert.equal(copywriterPersistedProposalSchema.safeParse({
    ...provider,
    sourceHash: `sha256:${"a".repeat(64)}`,
    protectedFactsHash: `sha256:${"b".repeat(64)}`,
  }).success, true);
  assert.equal(copywriterPersistedProposalSchema.safeParse({
    ...provider,
    sourceHash: "not-a-hash",
    protectedFactsHash: `sha256:${"b".repeat(64)}`,
  }).success, false);
});
