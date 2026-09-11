import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the editor preview calls the shared canvas renderer instead of building its own HTML", async () => {
  const source = await readFile("app/admin/(dashboard)/marketing/aftersales/AftersalesFlowEditor.tsx", "utf8");
  assert.match(source, /renderAftersalesCanvas/);
  assert.match(source, /from "@\/lib\/aftersales\/canvas-renderer"/);
});
