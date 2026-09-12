import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveCanvasFromLegacyContent,
  invoiceCanvasSchema,
  blockTextKey,
  INVOICE_TEMPLATE_BLOCK_KEYS,
  DEFAULT_INVOICE_TEMPLATE_BLOCKS,
  type InvoiceTemplateBlockLayout,
} from "../lib/invoice-template-schema";

function defaultLegacyBlocks(): InvoiceTemplateBlockLayout[] {
  return INVOICE_TEMPLATE_BLOCK_KEYS.map((key) => ({ key, ...DEFAULT_INVOICE_TEMPLATE_BLOCKS[key], textOverrides: null }));
}

test("migrating the never-edited default layout produces a valid canvas with one row per block key", () => {
  const { canvas } = deriveCanvasFromLegacyContent(defaultLegacyBlocks());
  assert.equal(invoiceCanvasSchema.safeParse(canvas).success, true);
  assert.equal(canvas.rows.length, INVOICE_TEMPLATE_BLOCK_KEYS.length);
  assert.deepEqual(canvas.rows.map((row) => row.columns[0].blocks[0].type), INVOICE_TEMPLATE_BLOCK_KEYS);
});

test("a legacy text override migrates into blockText under blockTextKey(key, field)", () => {
  const blocks = defaultLegacyBlocks().map((block) =>
    block.key === "footer" ? { ...block, textOverrides: { thankYouLine: "Bedankt!" } } : block
  );
  const { blockText } = deriveCanvasFromLegacyContent(blocks);
  assert.equal(blockText[blockTextKey("footer", "thankYouLine")], "Bedankt!");
});

test("a missing legacy block still produces its data-bound row from defaults", () => {
  const blocks = defaultLegacyBlocks().filter((block) => block.key !== "totals");
  const { canvas } = deriveCanvasFromLegacyContent(blocks);
  assert.ok(canvas.rows.some((row) => row.columns[0].blocks[0].type === "totals"));
});
