import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CopyWriterWorkspace,
  countSelectedChanges,
  nextProductToWork,
  overviewContext,
  productNeighbours,
  sortForWork,
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
  completeness: "NEEDS_REVIEW",
  attentionReasons: ["Productactietekst heeft geen bevestigde lagere actieprijs als bron."],
  attentionFields: [
    { field: "promotionText", label: "Productactietekst", reason: "Productactietekst heeft geen bevestigde lagere actieprijs als bron.", kind: "NEEDS_REVIEW", outsideCopywriter: false },
  ],
  acceptedFields: [],
  latestProposal: null,
};

const baseField = {
  group: "Verkooptekst",
  current: "Bestaande waarde",
  proposed: "Verbeterde waarde",
  maxLength: 160,
  sourcePaths: ["translation.name"],
  qualityStatus: "COMPLETE",
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
  stale: false,
  createdAt: "2026-09-08T11:05:00.000Z",
  fields: [
    { ...baseField, name: "name", label: "Productnaam", group: "Identiteit", current: product.name, proposed: "Ongebrande amandelen naturel", maxLength: 180 },
    { ...baseField, name: "slug", label: "Slug", group: "Identiteit", current: "ongebrande-amandelen", proposed: "ongebrande-amandelen-naturel" },
    { ...baseField, name: "shortDescription", label: "Korte omschrijving", maxLength: 220 },
    { ...baseField, name: "descriptionHtml", label: "Volledige omschrijving", current: "<p>Oud</p>", proposed: "<p>Nieuw en <strong>beter</strong></p>", maxLength: 20000 },
    { ...baseField, name: "promotionText", label: "Productactietekst", current: "Nu extra voordelig", proposed: "", qualityReason: "Er is geen lagere actieprijs. Deze actietekst wordt leeggemaakt." },
    { ...baseField, name: "seoTitle", label: "SEO-titel", group: "Vindbaarheid", current: "Zelfde titel", proposed: "Zelfde titel", maxLength: 60 },
    { ...baseField, name: "metaDescription", label: "Meta-omschrijving", group: "Vindbaarheid" },
    { ...baseField, name: "ingredients", label: "Ingrediënten", group: "Productfeiten", current: "AMANDELEN", proposed: "AMANDELEN", maxLength: 10000 },
    { ...baseField, name: "allergens", label: "Allergenen", group: "Productfeiten", current: "AMANDELEN", proposed: "AMANDELEN", maxLength: 10000 },
    { ...baseField, name: "mayContainTraces", label: "Kan sporen bevatten van", group: "Productfeiten", current: "", proposed: null, maxLength: 10000, qualityStatus: "MISSING", qualityReason: "Een gecontroleerde bron ontbreekt.", applyAllowed: false },
  ],
};

function catalog(): CopyWriterProduct[] {
  const factsOnly = { field: "allergens" as const, label: "Allergenen", reason: "Geverifieerde productinformatie ontbreekt.", kind: "MISSING" as const, outsideCopywriter: true };
  const missingSeo = { field: "seoTitle" as const, label: "SEO-titel", reason: "SEO-titel ontbreekt.", kind: "MISSING" as const, outsideCopywriter: false };
  return [
    { ...product, id: "done", name: "Cashewnoten", completeness: "COMPLETE", attentionReasons: [], attentionFields: [] },
    { ...product, id: "facts", name: "Dadels", completeness: "MISSING_PRODUCT_FACTS", attentionReasons: [factsOnly.reason], attentionFields: [factsOnly] },
    { ...product, id: "review", name: "Amandelen" },
    { ...product, id: "seo", name: "Walnoten", completeness: "MISSING_SEO", attentionReasons: [missingSeo.reason], attentionFields: [missingSeo] },
    { ...product, id: "draft", name: "Pecannoten", latestProposal: { status: "DRAFT", createdAt: "2026-09-08T11:05:00.000Z", appliedAt: null, errorCode: null } },
  ];
}

test("the overview is a to-do list ordered by what needs attention first", () => {
  const html = renderToStaticMarkup(<CopyWriterWorkspace mode="overview" initialProducts={catalog()} />);

  assert.match(html, /De Notenman CopyWriter/);
  assert.match(html, /Alle producten/);
  for (const label of ["Te doen", "Voorstel klaar", "Productinfo nodig", "Op orde"]) assert.match(html, new RegExp(label));
  assert.match(html, /Volgend product: Pecannoten/);
  assert.match(html, /min-h-11/);
  assert.doesNotMatch(html, /deterministisch/);

  assert.deepEqual(sortForWork(catalog()).map((item) => item.id), ["draft", "seo", "review", "facts", "done"]);
});

test("next product skips the open product and products the CopyWriter cannot fix", () => {
  assert.equal(nextProductToWork(catalog())?.id, "draft");
  assert.equal(nextProductToWork(catalog(), "draft")?.id, "seo");
  const onlyFactsAndDone = catalog().filter((item) => item.id === "facts" || item.id === "done");
  assert.equal(nextProductToWork(onlyFactsAndDone), null);
});

test("previous and next follow the overview order and its filter", () => {
  const all = productNeighbours(catalog(), "seo", overviewContext());
  assert.equal(all?.previous?.id, "draft");
  assert.equal(all?.next?.id, "review");
  assert.equal(all?.position, 2);
  assert.equal(all?.total, 5);

  const todo = productNeighbours(catalog(), "review", overviewContext("todo"));
  assert.equal(todo?.previous?.id, "seo");
  assert.equal(todo?.next, null, "products outside the filter are skipped");
  assert.equal(todo?.total, 3);

  const searched = productNeighbours(catalog(), "seo", overviewContext("ALL", "noten"));
  // "noten" matches Pecannoten, Walnoten and Cashewnoten, in overview order.
  assert.deepEqual([searched?.previous?.id, searched?.next?.id, searched?.total], ["draft", "done", 3]);

  assert.equal(overviewContext("onzin", "x".repeat(300)).filter, "ALL");
  assert.equal(productNeighbours(catalog(), "unknown", overviewContext()), null);
});

test("the product page links to the previous and next product within the selection", () => {
  const html = renderToStaticMarkup(
    <CopyWriterWorkspace mode="product" productId="seo" initialProducts={catalog()} initialProduct={catalog()[3]} initialProposal={null} filter="todo" />,
  );
  assert.match(html, /aria-label="Andere producten"/);
  assert.match(html, /Vorige/);
  assert.match(html, /Volgende/);
  assert.match(html, /Product 2 van 3 in deze selectie/);
  assert.match(html, /href="\/admin\/design-studio\/copywriter\/draft\?filter=todo&amp;locale=nl"/);
  assert.match(html, /href="\/admin\/design-studio\/copywriter\/review\?filter=todo&amp;locale=nl"/);
  assert.match(html, /href="\/admin\/design-studio\/copywriter\?filter=todo"/, "back to the same filtered overview");

  const first = renderToStaticMarkup(
    <CopyWriterWorkspace mode="product" productId="draft" initialProducts={catalog()} initialProduct={catalog()[4]} initialProposal={null} />,
  );
  assert.match(first, /aria-disabled="true"[^>]*>.*Vorige/s);
});

test("the product page shows only real changes with clear choices and nothing preselected", () => {
  const html = renderToStaticMarkup(
    <CopyWriterWorkspace mode="product" productId={product.id} initialProduct={product} initialProposal={proposal} />,
  );

  // name, slug, shortDescription, descriptionHtml, promotionText (clear) and metaDescription change.
  assert.equal((html.match(/data-editorial-field=/g) || []).length, 6);
  assert.match(html, /6 verbeteringen/);
  for (const label of ["Nu", "Voorstel", "Overnemen", "Aanpassen", "Laten zoals het is"]) assert.match(html, new RegExp(label));
  assert.match(html, /Alle verbeteringen overnemen \(6\)/);
  assert.match(html, /0 wijzigingen gekozen/);
  assert.match(html, /Wordt leeggemaakt/);
  assert.match(html, /Nieuw en beter/, "HTML is shown as readable text");
  assert.match(html, /SEO-titel:<\/strong> blijft hetzelfde/);
  assert.match(html, /Productinfo/);
  assert.match(html, /Aanvullen bij product/);
  assert.match(html, /href="\/admin\/producten\/product_1\?terug=%2Fadmin%2Fdesign-studio%2Fcopywriter%2Fproduct_1%3Flocale%3Dnl"/);
  assert.doesNotMatch(html, /MISSING_VERIFIED_SOURCE|NEEDS_REVIEW|Eindcontrole|Bronpaden|Locale/);
});

test("a field flagged for review can be kept as is from the product page", () => {
  const html = renderToStaticMarkup(
    <CopyWriterWorkspace mode="product" productId={product.id} initialProduct={product} initialProposal={null} />,
  );
  assert.match(html, /Wat aandacht nodig heeft/);
  assert.match(html, /Laten zoals het is/);
  assert.match(html, /Schrijf voorstel/);
  assert.match(source, /\/reviews`/);
});

test("a stale proposal cannot be saved and asks for a new one", () => {
  const html = renderToStaticMarkup(
    <CopyWriterWorkspace mode="product" productId={product.id} initialProduct={product} initialProposal={{ ...proposal, stale: true }} />,
  );
  assert.match(html, /aangepast nadat het voorstel is geschreven/);
  assert.match(html, /Nieuw voorstel schrijven/);
  assert.match(html, /Schrijf eerst een nieuw voorstel/);
});

test("after saving the page offers the next product", () => {
  const html = renderToStaticMarkup(
    <CopyWriterWorkspace mode="product" productId={product.id} initialProduct={product} initialProposal={{ ...proposal, status: "APPLIED" }} />,
  );
  assert.match(html, /Opgeslagen/);
  assert.match(html, /Volgend product/);
  assert.equal((html.match(/data-editorial-field=/g) || []).length, 0);
});

test("only explicit, applicable, actually changed text fields count as changes", () => {
  assert.equal(countSelectedChanges(proposal.fields, {}), 0);
  assert.equal(countSelectedChanges(proposal.fields, { name: "proposal", slug: "edit" }), 2);
  assert.equal(countSelectedChanges(proposal.fields, { mayContainTraces: "proposal", seoTitle: "proposal" }), 0);
  assert.equal(countSelectedChanges(proposal.fields, { ingredients: "proposal" }), 0);
  assert.equal(countSelectedChanges(proposal.fields, { promotionText: "proposal" }), 1);
});

test("saving keeps edits, explicit field selection, idempotency, cancel and retry", () => {
  assert.match(source, /method: "PATCH"/);
  assert.match(source, /\/api\/admin\/design-studio\/copywriter\/proposals/);
  assert.match(source, /APPLY_SELECTED_FIELDS/);
  assert.match(source, /Opslaan \(\$\{selectedCount\}\)/);
  assert.match(source, /AbortController/);
  assert.match(source, /Annuleren/);
  assert.match(source, /Opnieuw proberen/);
  assert.match(source, /STALE_PRODUCT/);
  assert.match(source, /generationKeyRef\.current = null/);
  assert.match(source, /applyKeyRef/);
  assert.match(source, /text-base/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /confirmButtonRef\.current\?\.focus/);
});
