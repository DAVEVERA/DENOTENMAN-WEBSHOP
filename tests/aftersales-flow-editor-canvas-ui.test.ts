import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the editor offers all ten block types and no longer edits the legacy design fields directly", async () => {
  const source = await readFile("app/admin/(dashboard)/marketing/aftersales/AftersalesFlowEditor.tsx", "utf8");
  for (const blockType of ["text", "image", "hero", "banner", "button", "table", "grid", "footer", "spacer", "customHtml"]) {
    assert.match(source, new RegExp(`"${blockType}"`));
  }
  assert.doesNotMatch(source, /updateDesign/);
  assert.match(source, /addRow|addBlock/);
});

test("blocks are draggable and dropping one onto a column moves it there", async () => {
  const source = await readFile("app/admin/(dashboard)/marketing/aftersales/AftersalesFlowEditor.tsx", "utf8");
  assert.match(source, /moveBlock/);
  assert.match(source, /draggable/);
});

test("selecting a column is real React state, not a ref, so the block-type palette actually re-renders enabled", async () => {
  const source = await readFile("app/admin/(dashboard)/marketing/aftersales/AftersalesFlowEditor.tsx", "utf8");
  assert.doesNotMatch(source, /selectedColumnRef/);
  assert.match(source, /const \[selectedColumn, setSelectedColumn\] = useState/);
  assert.match(source, /disabled=\{!selectedColumn\}/);
  assert.match(source, /setSelectedColumn\(\{ rowId: row\.id, columnId: column\.id \}\)/);
});

test("the legacy heading/body/buttonLabel inputs are gone - only subject and previewText remain wired to updateContent", async () => {
  const source = await readFile("app/admin/(dashboard)/marketing/aftersales/AftersalesFlowEditor.tsx", "utf8");
  assert.doesNotMatch(source, /id="mail-heading"/);
  assert.doesNotMatch(source, /id="mail-body"/);
  assert.doesNotMatch(source, /id="mail-button"/);
  assert.doesNotMatch(source, /updateContent\("heading"/);
  assert.doesNotMatch(source, /updateContent\("body"/);
  assert.doesNotMatch(source, /updateContent\("buttonLabel"/);
  assert.match(source, /id="mail-subject"/);
  assert.match(source, /id="mail-preview"/);
  assert.match(source, /updateContent\("subject"/);
  assert.match(source, /updateContent\("previewText"/);
});
