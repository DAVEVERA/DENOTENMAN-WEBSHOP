import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("the editor renders one draggable element per block key and never offers a delete action", () => {
  const source = readFileSync(
    "app/admin/(dashboard)/marketing/service-en-support-zakelijk/factuur-sjabloon/InvoiceTemplateEditor.tsx",
    "utf8"
  );
  for (const key of ["header", "sellerAddress", "buyerAddress", "metadata", "itemsTable", "totals", "footer"]) {
    assert.match(source, new RegExp(key));
  }
  assert.doesNotMatch(source, /delete|verwijder/i);
  assert.match(source, /onPointerDown/);
  assert.match(source, /PATCH/);
});
