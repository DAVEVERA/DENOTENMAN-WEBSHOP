import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { GeminiImageWorkspace } from "../components/admin-panel/design-studio/GeminiImageWorkspace";

const source = readFileSync(join(process.cwd(), "components/admin-panel/design-studio/GeminiImageWorkspace.tsx"), "utf8");

test("Gemini workspace offers Flash and Pro while keeping concepts separate from publication", () => {
  const html = renderToStaticMarkup(<GeminiImageWorkspace
    initialProducts={[{ id: "product_1", name: "Amandelen", images: [{ id: "image_1", url: "https://example.com/source.webp", alt: "Amandelen", isPrimary: true, sortOrder: 0 }] }]}
    initialAssets={[{
      id: "asset_1",
      jobId: "job_1",
      productId: "product_1",
      sourceImageId: "image_1",
      url: "https://example.com/concept.webp",
      width: 1024,
      height: 1024,
      fileSize: 2048,
      status: "DRAFT",
      productImageId: null,
      createdAt: "2026-10-06T12:00:00.000Z",
    }]}
    configured
    allowed
  />);
  assert.match(html, /Gemini Flash/);
  assert.match(html, /Gemini Pro/);
  assert.match(html, /Realistische studio-productfoto/);
  assert.match(html, /Brede homepagebanner/);
  assert.match(html, /Gemini-concept maken/);
  assert.match(html, /Als nieuwe productfoto toevoegen/);
  assert.match(html, /Dit start een betaalde Gemini-aanvraag/);
  assert.doesNotMatch(html, /<form\b/i);
  assert.match(html, /min-h-11/);
});

test("Gemini workspace checks model access and keeps retries idempotent", () => {
  assert.match(source, /api\/admin\/design-studio\/gemini-image\/status/);
  assert.match(source, /api\/admin\/design-studio\/gemini-image\/jobs/);
  assert.match(source, /idempotencyKey\.current \|\|= `gemini-image:/);
  assert.match(source, /cause instanceof ApiResponseError && \(cause\.status < 500/);
  assert.match(source, /cause\.code === "INVALID_CONFIGURATION"/);
  assert.match(source, /availableModels\.includes\(modelId\)/);
  assert.match(source, /Tekst en huisstijl toevoegen in Canva/);
});
