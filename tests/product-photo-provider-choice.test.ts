import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const pageSource = readFileSync(join(process.cwd(), "app/admin/(dashboard)/design-studio/productfotos/page.tsx"), "utf8");

test("product photos expose Gemini, PhotoRoom and VModel without mixing provider assets", () => {
  assert.match(pageSource, /provider === "photoroom"/);
  assert.match(pageSource, /provider === "vmodel"/);
  assert.match(pageSource, /: "GEMINI"/);
  assert.match(pageSource, /job: \{ provider: databaseProvider \}/);
  assert.match(pageSource, /Kies Gemini, PhotoRoom of VModel/);
  assert.match(pageSource, /GeminiImageWorkspace/);
  assert.match(pageSource, /mode="product-photos"/);
  assert.match(pageSource, /initialPendingJobs=\{pendingJobs\.map\(vModelJobDto\)\}/);
  assert.match(pageSource, /configured=\{Boolean\(process\.env\.VMODEL_API_KEY/);
  assert.match(pageSource, /process\.env\.GEMINI_API_KEY/);
});

test("product provider links retain the selected product and source image", () => {
  assert.match(pageSource, /providerHref\("gemini", productId, imageId\)/);
  assert.match(pageSource, /providerHref\("photoroom", productId, imageId\)/);
  assert.match(pageSource, /providerHref\("vmodel", productId, imageId\)/);
  assert.match(pageSource, /aria-current=\{selectedProvider === "vmodel" \? "page" : undefined\}/);
});
