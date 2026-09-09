import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CopyWriterWorkspace,
  countSelectedChanges,
  type CopyWriterProduct,
  type CopyWriterProposal,
} from "../components/admin-panel/design-studio/CopyWriterWorkspace";

const source = readFileSync(
  join(process.cwd(), "components/admin-panel/design-studio/CopyWriterWorkspace.tsx"),
  "utf8",
);

const product: CopyWriterProduct = {
  id: "product_1",
  name: "Ongebrande amandelen",
  sku: "NOT-001",
  imageUrl: "https://example.com/amandelen.webp",
  active: true,
  updatedAt: "2026-09-08T11:00:00.000Z",
  completeness: "MISSING_PRODUCT_FACTS",
  attentionReasons: ["Kan sporen bevatten van mist"],
};

const baseField = {
  group: "Verkooptekst",
  current: "Bestaande waarde",
  proposed: "Verbeterde waarde",
  maxLength: 160,
  sourcePaths: ["ProductTranslation.field"],
  qualityStatus: "IMPROVEMENT",
  qualityReason: "Concreter en productspecifiek.",
  warnings: [] as string[],
  applyAllowed: true,
};

const proposal: CopyWriterProposal = {
  id: "proposal_1",
  productId: product.id,
  product,
  locale: "nl",
  status: "DRAFT",
  sourceProductVersion: product.updatedAt,
  protectedFactsHash: "facts_hash_1",
  fields: [
    { ...baseField, name: "name", label: "Productnaam", group: "Identiteit", current: product.name, proposed: "Ongebrande amandelen naturel", maxLength: 180, sourcePaths: ["ProductTranslation.name"] },
    { ...baseField, name: "slug", label: "Slug", group: "Identiteit", current: "ongebrande-amandelen", proposed: "ongebrande-amandelen-naturel", sourcePaths: ["ProductTranslation.slug"], warnings: ["Een slugwijziging maakt een nieuwe URL."] },
    { ...baseField, name: "shortDescription", label: "Korte omschrijving", maxLength: 220 },
    { ...baseField, name: "descriptionHtml", label: "Volledige omschrijving", maxLength: 20000 },
    { ...baseField, name: "promotionText", label: "Productactietekst", current: "", proposed: null, applyAllowed: false, qualityStatus: "KEEP_CURRENT", qualityReason: "Er is geen actuele prijsactie." },
    { ...baseField, name: "seoTitle", label: "SEO-titel", group: "Vindbaarheid", maxLength: 60 },
    { ...baseField, name: "metaDescription", label: "Meta-omschrijving", group: "Vindbaarheid" },
    { ...baseField, name: "ingredients", label: "Ingrediënten", group: "Productfeiten", current: "AMANDELEN", proposed: "AMANDELEN", maxLength: 10000, qualityStatus: "SOURCE_EXACT", qualityReason: "Bevestigde productfeiten blijven exact behouden." },
    { ...baseField, name: "allergens", label: "Allergenen", group: "Productfeiten", current: "AMANDELEN", proposed: "AMANDELEN", maxLength: 10000, qualityStatus: "SOURCE_EXACT", qualityReason: "Bevestigde productfeiten blijven exact behouden." },
    { ...baseField, name: "mayContainTraces", label: "Kan sporen bevatten van", group: "Productfeiten", current: "", proposed: null, maxLength: 10000, qualityStatus: "MISSING_VERIFIED_SOURCE", qualityReason: "Een gecontroleerde bron ontbreekt.", warnings: ["Vul dit feit niet in zonder etiket of leveranciersspecificatie."], applyAllowed: false },
  ],
};

test("CopyWriter overview makes the full-catalog completeness workflow visible", () => {
  const html = renderToStaticMarkup(
    <CopyWriterWorkspace mode="overview" initialProducts={[
      product,
      { ...product, id: "product_2", name: "Cashewnoten", completeness: "COMPLETE" },
      { ...product, id: "product_3", name: "Dadels", completeness: "MISSING_TEXT" },
      { ...product, id: "product_4", name: "Walnoten", completeness: "MISSING_SEO" },
      { ...product, id: "product_5", name: "Pecannoten", completeness: "NEEDS_REVIEW" },
    ]} />,
  );

  assert.match(html, /De Notenman CopyWriter/);
  assert.match(html, /Alle producten/);
  assert.match(html, /Compleet/);
  assert.match(html, /Tekst mist/);
  assert.match(html, /SEO mist/);
  assert.match(html, /Productfeiten missen/);
  assert.match(html, /Controle nodig/);
  assert.match(html, /Volgend product met aandacht/);
  assert.match(html, /min-h-11/);
});

test("CopyWriter editorial ledger shows current and proposed values with zero preselection", () => {
  const html = renderToStaticMarkup(
    <CopyWriterWorkspace mode="product" productId={product.id} initialProduct={product} initialProposal={proposal} />,
  );

  assert.equal((html.match(/data-editorial-field=/g) || []).length, 10);
  assert.match(html, /Huidige waarde/);
  assert.match(html, /Voorstel/);
  assert.match(html, /Huidig behouden/);
  assert.match(html, /Voorstel gebruiken/);
  assert.match(html, /Bewerken en meenemen/);
  assert.match(html, /ProductTranslation\.name/);
  assert.match(html, /0 wijzigingen geselecteerd/);
  assert.match(html, /Een gecontroleerde bron ontbreekt/);
  assert.match(html, /MISSING_VERIFIED_SOURCE/);
  assert.doesNotMatch(html, /Alles selecteren/i);
});

test("CopyWriter counts only explicit, applicable, actually changed field decisions", () => {
  assert.equal(countSelectedChanges(proposal.fields, {}), 0);
  assert.equal(countSelectedChanges(proposal.fields, { name: "proposal", slug: "edit" }), 2);
  assert.equal(countSelectedChanges(proposal.fields, { mayContainTraces: "proposal", promotionText: "edit" }), 0);
  assert.equal(countSelectedChanges(proposal.fields, { ingredients: "proposal" }), 0);
});

test("CopyWriter persists edits before an explicit selected-fields apply and supports retry or cancel", () => {
  assert.match(source, /method: "PATCH"/);
  assert.match(source, /\/api\/admin\/design-studio\/copywriter\/proposals/);
  assert.match(source, /APPLY_SELECTED_FIELDS/);
  assert.match(source, /Pas \$\{selectedCount\} wijzigingen toe/);
  assert.match(source, /AbortController/);
  assert.match(source, /Annuleren/);
  assert.match(source, /Opnieuw proberen/);
  assert.match(source, /STALE_PRODUCT/);
  assert.match(source, /generationKeyRef/);
  assert.match(source, /applyKeyRef/);
  assert.match(source, /text-base/);
  assert.doesNotMatch(source, /Alles selecteren/i);
});
