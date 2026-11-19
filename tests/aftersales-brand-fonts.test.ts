import assert from "node:assert/strict";
import test from "node:test";
import { AFTERSALES_FONTS, aftersalesCanvasSchema, defaultAftersalesDesign } from "../lib/aftersales/schema";
import { renderAftersalesCanvas } from "../lib/aftersales/canvas-renderer";

test("aftersales editor offers Dosis and Montserrat as the brand fonts", () => {
  assert.deepEqual(AFTERSALES_FONTS, ["DOSIS", "MONTSERRAT"]);
  assert.equal(defaultAftersalesDesign.font, "MONTSERRAT");
});

test("aftersales email renders both brand fonts and accepts existing saved fonts", () => {
  const makeCanvas = (font: "DOSIS" | "MONTSERRAT" | "SANS") => aftersalesCanvasSchema.parse({
    rows: [{
      id: "row", backgroundColor: "#ffffff", padding: 0,
      columns: [{
        id: "column", widthFraction: 1, backgroundColor: "#ffffff", padding: 0,
        blocks: [{ id: "text", type: "text", font, size: "STANDAARD", color: "#141414", align: "left", bold: false, italic: false }],
      }],
    }],
  });
  const options = { escapeText: (text: string) => text, resolveText: () => "Bericht", defaultActionUrl: "https://example.com" };
  assert.match(renderAftersalesCanvas(makeCanvas("DOSIS"), options), /font-family:Dosis/);
  assert.match(renderAftersalesCanvas(makeCanvas("MONTSERRAT"), options), /font-family:Montserrat/);
  assert.match(renderAftersalesCanvas(makeCanvas("SANS"), options), /font-family:Arial/);
});
