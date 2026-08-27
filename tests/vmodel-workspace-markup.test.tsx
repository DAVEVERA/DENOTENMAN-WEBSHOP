import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { VModelWorkspace } from "../components/admin-panel/design-studio/VModelWorkspace";
import { vModelModels } from "../lib/design-studio/vmodel-models";

const source = readFileSync(join(process.cwd(), "components/admin-panel/design-studio/VModelWorkspace.tsx"), "utf8");

test("VModel workspace exposes three curated models and keeps generation separate from publication", () => {
  const html = renderToStaticMarkup(<VModelWorkspace
    initialProducts={[{ id: "product_1", name: "Amandelen", images: [{ id: "image_1", url: "https://example.com/source.webp", alt: "Amandelen", isPrimary: true, sortOrder: 0 }] }]}
    initialAssets={[{
      id: "asset_1",
      jobId: "job_1",
      productId: "product_1",
      sourceImageId: "image_1",
      url: "https://example.com/concept.webp",
      width: 1200,
      height: 1200,
      fileSize: 2048,
      status: "DRAFT",
      productImageId: null,
      createdAt: "2026-08-26T12:00:00.000Z",
    }]}
    initialPendingJobs={[]}
    configured
    allowed
  />);
  assert.equal(vModelModels.length, 3);
  for (const model of ["Nano Banana 2", "Nano Banana Pro", "Seedream 4.5"]) assert.match(html, new RegExp(model.replace(".", "\\.")));
  assert.match(html, /Campagneconcept maken/);
  assert.match(html, /Aan productgalerij toevoegen/);
  assert.match(html, /Voor · origineel/);
  assert.match(html, /Na · concept/);
  assert.match(html, /Veiligheidscontrole blijft altijd ingeschakeld/);
  assert.match(html, /maximaal 25/i);
  assert.doesNotMatch(html, /<form\b/i);
  assert.match(html, /min-h-11/);
});

test("VModel workspace keeps retries idempotent and status polling bounded", () => {
  assert.match(source, /idempotencyKey\.current \|\|= `vmodel:/);
  assert.match(source, /for \(let check = 0; check < 60; check \+= 1\)/);
  assert.match(source, /status later veilig hervatten/);
  assert.match(source, /cause instanceof ApiResponseError && cause\.status < 500/);
  assert.match(source, /text-base[\s\S]*md:text-body-sm/);
});
