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
