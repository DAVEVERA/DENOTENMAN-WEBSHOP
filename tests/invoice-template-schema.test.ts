import assert from "node:assert/strict";
import test from "node:test";
import {
  INVOICE_TEMPLATE_BLOCK_KEYS,
  DEFAULT_INVOICE_TEMPLATE_BLOCKS,
  EDITABLE_TEXT_KEYS_BY_BLOCK,
} from "../lib/invoice-template-schema";

test("every block key has a default layout entry within A4 bounds", () => {
  for (const key of INVOICE_TEMPLATE_BLOCK_KEYS) {
    const layout = DEFAULT_INVOICE_TEMPLATE_BLOCKS[key];
    assert.ok(layout, `missing default for ${key}`);
    assert.ok(layout.x >= 0 && layout.x + layout.width <= 595, `${key} exceeds page width`);
    assert.ok(layout.y >= 0 && layout.y + layout.height <= 842, `${key} exceeds page height`);
  }
});

test("every block has an explicit editable-text-key list, even if empty", () => {
  for (const key of INVOICE_TEMPLATE_BLOCK_KEYS) {
    assert.ok(Array.isArray(EDITABLE_TEXT_KEYS_BY_BLOCK[key]), `missing text-key list for ${key}`);
  }
});
