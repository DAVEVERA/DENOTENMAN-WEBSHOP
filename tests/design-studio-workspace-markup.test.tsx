import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PhotoRoomWorkspace } from "../components/admin-panel/design-studio/PhotoRoomWorkspace";

const workspaceSource = readFileSync(join(process.cwd(), "components/admin-panel/design-studio/PhotoRoomWorkspace.tsx"), "utf8");

test("PhotoRoom workspace keeps creation and publication explicitly separate", () => {
  const html = renderToStaticMarkup(
    <PhotoRoomWorkspace
      initialProducts={[{
        id: "product_1",
        name: "Amandelen",
        images: [{ id: "image_1", url: "https://example.com/source.webp", alt: "Amandelen", isPrimary: true, sortOrder: 0 }],
      }]}
      initialAssets={[{
        id: "asset_1",
        jobId: "job_1",
        productId: "product_1",
        sourceImageId: "image_1",
        url: "https://example.com/draft.webp",
        width: 1200,
        height: 1200,
        fileSize: 1024,
        status: "DRAFT",
        productImageId: null,
        createdAt: "2026-08-20T12:00:00.000Z",
      }]}
      configured
      allowed
    />
  );
  assert.match(html, /Voor · origineel/);
  assert.match(html, /Na · concept/);
  assert.match(html, /Concept maken/);
  assert.match(html, /Als nieuwe productfoto toevoegen/);
  assert.match(html, /Maak campagnebeeld/);
  assert.match(html, /campagnebeelden\?productId=product_1&amp;imageId=image_1/);
  assert.match(html, /maximaal 25 providerpogingen/i);
  assert.doesNotMatch(html, /<form\b/i);
  assert.match(html, /min-h-11/);
});

test("PhotoRoom retries use a fresh key after definitive errors or changed inputs", () => {
  assert.match(workspaceSource, /cause instanceof ApiResponseError/);
  assert.match(workspaceSource, /function changeRequestInput/);
  assert.match(workspaceSource, /idempotencyKey\.current = null/);
  assert.match(workspaceSource, /changeRequestInput\(\(\) => setBackground/);
  assert.match(workspaceSource, /changeRequestInput\(\(\) => setImageId/);
  assert.match(workspaceSource, /changeRequestInput\(\(\) => setImageId\(body\.image\.id\)\)/);
});

test("PhotoRoom workspace verifies provider credits before enabling generation", () => {
  assert.match(workspaceSource, /api\/admin\/design-studio\/photoroom\/status/);
  assert.match(workspaceSource, /PhotoRoom-tegoed op/);
  assert.match(workspaceSource, /providerStatus === "ready"/);
});
