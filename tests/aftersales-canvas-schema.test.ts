// tests/aftersales-canvas-schema.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  aftersalesCanvasSchema,
  blockTextKey,
  deriveCanvasFromLegacyContent,
  parseAftersalesContent,
  defaultAftersalesDesign,
  type AftersalesLegacyContent,
} from "../lib/aftersales/schema";

const legacyLocales: AftersalesLegacyContent = {
  nl: { subject: "Onderwerp", previewText: "Preview", heading: "Kop", body: "Tekst", buttonLabel: "Bekijk" },
  en: { subject: "Subject", previewText: "Preview", heading: "Heading", body: "Text", buttonLabel: "View" },
  fr: { subject: "Objet", previewText: "Aperçu", heading: "Titre", body: "Texte", buttonLabel: "Voir" },
};

test("blockTextKey composes a stable, unique key per block and optional field", () => {
  assert.equal(blockTextKey("heading"), "heading");
  assert.equal(blockTextKey("hero-1", "heading"), "hero-1:heading");
});

test("CLASSIC design derives one row, one column, heading+body+button, structure shared across locales", () => {
  const { canvas, blockTextByLocale } = deriveCanvasFromLegacyContent(defaultAftersalesDesign, legacyLocales);
  assert.equal(aftersalesCanvasSchema.safeParse(canvas).success, true);
  assert.equal(canvas.rows.length, 1);
  assert.equal(canvas.rows[0].columns.length, 1);
  const types = canvas.rows[0].columns[0].blocks.map((block) => block.type);
  assert.deepEqual(types, ["text", "text", "button"]);
  assert.equal(blockTextByLocale.nl[blockTextKey("heading")], "Kop");
  assert.equal(blockTextByLocale.en[blockTextKey("heading")], "Heading");
  assert.equal(blockTextByLocale.nl[blockTextKey("button")], "Bekijk");
});

test("IMAGE_SIDE design derives two columns, image left, text right", () => {
  const design = { ...defaultAftersalesDesign, layout: "IMAGE_SIDE" as const, mediaUrl: "https://cdn.example/a.png" };
  const { canvas } = deriveCanvasFromLegacyContent(design, legacyLocales);
  assert.equal(canvas.rows[0].columns.length, 2);
  assert.equal(canvas.rows[0].columns[0].blocks[0].type, "image");
  assert.equal(canvas.rows[0].columns[1].blocks.map((block) => block.type).includes("text"), true);
});

test("GRID_2COL design derives a grid block whose items keep the same text for every locale", () => {
  const design = {
    ...defaultAftersalesDesign,
    layout: "GRID_2COL" as const,
    gridItems: [{ imageUrl: null, imageAlt: "", heading: "Item 1", body: "Body 1" }],
  };
  const { canvas, blockTextByLocale } = deriveCanvasFromLegacyContent(design, legacyLocales);
  const gridBlock = canvas.rows[0].columns[0].blocks.find((block) => block.type === "grid");
  assert.ok(gridBlock && gridBlock.type === "grid");
  const itemId = gridBlock.items[0].id;
  assert.equal(blockTextByLocale.nl[blockTextKey(itemId, "heading")], "Item 1");
  assert.equal(blockTextByLocale.en[blockTextKey(itemId, "heading")], "Item 1");
});

test("TABLE design derives a table block whose header/cell text keeps the same value for every locale", () => {
  const design = {
    ...defaultAftersalesDesign,
    layout: "TABLE" as const,
    tableHeaders: ["Kolom A"],
    tableRows: [{ cells: ["Waarde 1"] }],
  };
  const { canvas, blockTextByLocale } = deriveCanvasFromLegacyContent(design, legacyLocales);
  const tableBlock = canvas.rows[0].columns[0].blocks.find((block) => block.type === "table");
  assert.ok(tableBlock && tableBlock.type === "table");
  assert.equal(tableBlock.headerCount, 1);
  assert.equal(tableBlock.rowIds.length, 1);
  assert.equal(blockTextByLocale.fr[blockTextKey(tableBlock.id, `header:0`)], "Kolom A");
  assert.equal(blockTextByLocale.fr[blockTextKey(tableBlock.id, `cell:${tableBlock.rowIds[0]}:0`)], "Waarde 1");
});

test("TABLE design with rows but no configured headers still derives a headerCount wide enough to keep every cell", () => {
  const design = {
    ...defaultAftersalesDesign,
    layout: "TABLE" as const,
    tableHeaders: [],
    tableRows: [{ cells: ["Amandelen", "€ 4,95"] }, { cells: ["Cashews", "€ 6,25", "Extra"] }],
  };
  const { canvas, blockTextByLocale } = deriveCanvasFromLegacyContent(design, legacyLocales);
  const tableBlock = canvas.rows[0].columns[0].blocks.find((block) => block.type === "table");
  assert.ok(tableBlock && tableBlock.type === "table");
  // Widest row has 3 cells, so headerCount must be at least 3 even though
  // zero headers were configured - otherwise renderTableBlock's cell loop
  // (which runs headerCount times) would drop every cell in every row.
  assert.equal(tableBlock.headerCount, 3);
  assert.equal(blockTextByLocale.nl[blockTextKey(tableBlock.id, `cell:${tableBlock.rowIds[1]}:2`)], "Extra");
  // No header text should be fabricated for the columns beyond the (empty)
  // configured header list.
  assert.equal(blockTextByLocale.nl[blockTextKey(tableBlock.id, `header:0`)], undefined);
});

test("headings derived from legacy content are one font-size tier larger than the body, capped at GROOT", () => {
  const compact = deriveCanvasFromLegacyContent({ ...defaultAftersalesDesign, fontSize: "COMPACT" }, legacyLocales);
  const compactHeading = compact.canvas.rows[0].columns[0].blocks.find((block) => block.type === "text" && block.bold);
  const compactBody = compact.canvas.rows[0].columns[0].blocks.find((block) => block.type === "text" && !block.bold);
  assert.equal(compactHeading?.type === "text" && compactHeading.size, "STANDAARD");
  assert.equal(compactBody?.type === "text" && compactBody.size, "COMPACT");

  const standard = deriveCanvasFromLegacyContent({ ...defaultAftersalesDesign, fontSize: "STANDAARD" }, legacyLocales);
  const standardHeading = standard.canvas.rows[0].columns[0].blocks.find((block) => block.type === "text" && block.bold);
  assert.equal(standardHeading?.type === "text" && standardHeading.size, "GROOT");

  const groot = deriveCanvasFromLegacyContent({ ...defaultAftersalesDesign, fontSize: "GROOT" }, legacyLocales);
  const grootHeading = groot.canvas.rows[0].columns[0].blocks.find((block) => block.type === "text" && block.bold);
  assert.equal(grootHeading?.type === "text" && grootHeading.size, "GROOT");
});

test("the migrated row has zero padding so it doesn't double up on renderEmailShell's own padding wrapper", () => {
  const { canvas } = deriveCanvasFromLegacyContent(defaultAftersalesDesign, legacyLocales);
  assert.equal(canvas.rows[0].padding, 0);
});

test("parseAftersalesContent always returns a canvas, deriving it when the stored JSON has none", () => {
  const legacyStoredShape = { locales: legacyLocales, design: defaultAftersalesDesign };
  const resolved = parseAftersalesContent(legacyStoredShape);
  assert.equal(aftersalesCanvasSchema.safeParse(resolved.canvas).success, true);
  assert.equal(resolved.locales.nl.blockText[blockTextKey("heading")], "Kop");
});

test("parseAftersalesContent trusts an explicitly stored canvas instead of re-deriving it", () => {
  const explicitCanvas = {
    rows: [{ id: "r1", backgroundColor: "#ffffff", padding: 20, columns: [{ id: "c1", widthFraction: 1, backgroundColor: "#ffffff", padding: 0, blocks: [] }] }],
  };
  const stored = { locales: { ...legacyLocales, nl: { ...legacyLocales.nl, blockText: {} } }, design: defaultAftersalesDesign, canvas: explicitCanvas };
  const resolved = parseAftersalesContent(stored);
  assert.deepEqual(resolved.canvas, explicitCanvas);
});

test("aftersalesCanvasSchema rejects a row with zero columns and a block with a non-hex color", () => {
  assert.equal(aftersalesCanvasSchema.safeParse({ rows: [{ id: "r", backgroundColor: "#fff", padding: 0, columns: [] }] }).success, false);
  const bad = { rows: [{ id: "r", backgroundColor: "#fff", padding: 0, columns: [{ id: "c", widthFraction: 1, backgroundColor: "not-a-color", padding: 0, blocks: [] }] }] };
  assert.equal(aftersalesCanvasSchema.safeParse(bad).success, false);
});
