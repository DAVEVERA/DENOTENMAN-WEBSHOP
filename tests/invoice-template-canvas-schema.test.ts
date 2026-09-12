import assert from "node:assert/strict";
import test from "node:test";
import { invoiceCanvasSchema, blockTextKey, type InvoiceCanvas } from "../lib/invoice-template-schema";

function sampleCanvas(): InvoiceCanvas {
  return {
    rows: [
      {
        id: "row-1",
        backgroundColor: "#ffffff",
        padding: 0,
        columns: [
          { id: "col-1", widthFraction: 1, backgroundColor: "#ffffff", padding: 0, blocks: [
            { id: "header", type: "header", backgroundColor: "#ffffff", textColor: "#333333" },
          ] },
        ],
      },
    ],
  };
}

test("a well-formed canvas parses successfully", () => {
  assert.equal(invoiceCanvasSchema.safeParse(sampleCanvas()).success, true);
});

test("a row whose column widths don't sum to 1 is rejected", () => {
  const canvas = sampleCanvas();
  canvas.rows[0].columns[0].widthFraction = 0.5;
  assert.equal(invoiceCanvasSchema.safeParse(canvas).success, false);
});

test("the same data-bound block type appearing twice is rejected", () => {
  const canvas = sampleCanvas();
  canvas.rows.push(structuredClone(canvas.rows[0]));
  assert.equal(invoiceCanvasSchema.safeParse(canvas).success, false);
});

test("an unknown block type is rejected", () => {
  const canvas = sampleCanvas();
  // @ts-expect-error deliberately invalid for the test
  canvas.rows[0].columns[0].blocks[0].type = "nonsense";
  assert.equal(invoiceCanvasSchema.safeParse(canvas).success, false);
});

test("blockTextKey composes and omits the field separator when absent", () => {
  assert.equal(blockTextKey("block-1"), "block-1");
  assert.equal(blockTextKey("block-1", "title"), "block-1:title");
});
