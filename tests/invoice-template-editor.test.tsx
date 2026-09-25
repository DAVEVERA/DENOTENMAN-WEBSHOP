import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { InvoiceTemplateEditor } from "../app/admin/(dashboard)/marketing/service-en-support-zakelijk/factuur-sjabloon/InvoiceTemplateEditor";
import { INVOICE_DATA_BLOCK_TYPES, type InvoiceBlock, type InvoiceCanvas } from "../lib/invoice-template-schema";

function renderEditor(blocks: InvoiceBlock[]) {
  const canvas: InvoiceCanvas = {
    rows: [{ id: "row", backgroundColor: "#ffffff", padding: 0, columns: [{
      id: "column", widthFraction: 1, backgroundColor: "#ffffff", padding: 0, blocks,
    }] }],
  };
  return renderToStaticMarkup(
    <InvoiceTemplateEditor templateId="template" initialCanvas={canvas} initialBlockText={{}} />
  );
}

test("the editor protects every invoice data block from removal and duplicate insertion", () => {
  for (const type of INVOICE_DATA_BLOCK_TYPES) {
    const markup = renderEditor([{ id: type, type, backgroundColor: "#ffffff", textColor: "#333333" }]);
    assert.doesNotMatch(markup, />Verwijder<\/button>/, type);
    assert.equal((markup.match(/<button[^>]*disabled=""/g) ?? []).length, 1, type);
    assert.match(markup, />↑<\/button>/);
    assert.match(markup, />↓<\/button>/);
  }
});

test("the editor allows removal of all free block types", () => {
  const freeBlocks: InvoiceBlock[] = [
    { id: "text", type: "text", font: "SANS", size: "STANDAARD", color: "#333333", align: "left", bold: false, italic: false },
    { id: "image", type: "image", mediaUrl: null, alt: "", widthPt: 200, align: "left" },
    { id: "spacer", type: "spacer", heightPt: 20, showDivider: false },
    { id: "divider", type: "divider", color: "#dddddd", thicknessPt: 1 },
    { id: "customHtml", type: "customHtml" },
  ];
  for (const block of freeBlocks) {
    const markup = renderEditor([block]);
    assert.equal((markup.match(/>Verwijder<\/button>/g) ?? []).length, 1, block.type);
  }
});

test("the editor guards the removal handler and saves edits through PATCH", () => {
  const source = readFileSync(
    "app/admin/(dashboard)/marketing/service-en-support-zakelijk/factuur-sjabloon/InvoiceTemplateEditor.tsx",
    "utf8"
  );
  assert.match(source, /if \(!blockToRemove \|\| isDataBlock\(blockToRemove\)\) return;/);
  assert.match(source, /PATCH/);
});
