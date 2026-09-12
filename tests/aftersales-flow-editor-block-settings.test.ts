import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("selecting a text, image, button or spacer block shows its own settings fields", async () => {
  const source = await readFile("app/admin/(dashboard)/marketing/aftersales/AftersalesFlowEditor.tsx", "utf8");
  assert.match(source, /ColorField/);
  assert.match(source, /selectedBlock\.type === "text"/);
  assert.match(source, /selectedBlock\.type === "image"/);
  assert.match(source, /selectedBlock\.type === "button"/);
  assert.match(source, /selectedBlock\.type === "spacer"/);
});

test("selecting a hero, banner, footer or customHtml block shows its own settings fields", async () => {
  const source = await readFile("app/admin/(dashboard)/marketing/aftersales/AftersalesFlowEditor.tsx", "utf8");
  assert.match(source, /selectedBlock\.type === "hero"/);
  assert.match(source, /selectedBlock\.type === "banner"/);
  assert.match(source, /selectedBlock\.type === "footer"/);
  assert.match(source, /selectedBlock\.type === "customHtml"/);
});

test("selecting a table or grid block shows its own settings fields, and the legacy grid media-picker target is gone", async () => {
  const source = await readFile("app/admin/(dashboard)/marketing/aftersales/AftersalesFlowEditor.tsx", "utf8");
  assert.match(source, /selectedBlock\.type === "table"/);
  assert.match(source, /selectedBlock\.type === "grid"/);
  assert.doesNotMatch(source, /gridIndex/);
});

test("pickMedia's plain blockId branch updates hero and banner backgroundUrl, not just image mediaUrl", async () => {
  const source = await readFile("app/admin/(dashboard)/marketing/aftersales/AftersalesFlowEditor.tsx", "utf8");
  assert.match(source, /block\.type === "hero" \|\| block\.type === "banner" \? \{ \.\.\.block, backgroundUrl: url \}/);
});

test("the dead 'step' media-picker target (the deleted design panel's mediaUrl picker) is gone", async () => {
  const source = await readFile("app/admin/(dashboard)/marketing/aftersales/AftersalesFlowEditor.tsx", "utf8");
  assert.doesNotMatch(source, /"logo" \| "step"/);
  assert.doesNotMatch(source, /mediaPickerFor === "step"/);
  assert.doesNotMatch(source, /openMediaPicker\("step"\)/);
});
