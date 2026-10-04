import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  productStatusMutationMode,
  VISIBILITY_UNDO_WINDOW_MS,
} from "../components/admin-panel/ProductAdminForm";

test("product status changes preserve dirty edits and keep clean edits lightweight", () => {
  assert.equal(productStatusMutationMode("create", false), "local");
  assert.equal(productStatusMutationMode("edit", true), "full-save");
  assert.equal(productStatusMutationMode("edit", false), "direct");
  assert.equal(VISIBILITY_UNDO_WINDOW_MS, 10_000);
});

test("the product editor confirms status changes and exposes the timed undo control", () => {
  const source = readFileSync("components/admin-panel/ProductAdminForm.tsx", "utf8");

  assert.match(source, /window\.confirm\(confirmation\)/);
  assert.match(source, /persistProduct\(nextIsActive, true\)/);
  assert.match(source, /updateVisibilityDirect\(nextIsActive, product\.version, true\)/);
  assert.match(source, /undo\.token/);
  assert.match(source, /initiatedByVisibility && body\.undoToken/);
  assert.match(source, /Status ongedaan maken \(10 sec\.\)/);
});

test("the product overview uses mobile cards while retaining the desktop table", () => {
  const source = readFileSync("app/admin/(dashboard)/producten/page.tsx", "utf8");

  assert.match(source, /grid gap-3 md:hidden/);
  assert.match(source, /hidden max-h-\[75vh\].*md:block/);
  assert.match(source, /<article/);
  assert.match(source, /<table/);
  assert.match(source, /min-h-11 w-full/);
  assert.match(source, /Effectieve prijs/);
  assert.match(source, /salePriceCents \?\? variant\.priceCents/);
});

test("all product publication APIs use the shared readiness validator", () => {
  const updateRoute = readFileSync("app/api/admin/products/[id]/route.ts", "utf8");
  const visibilityRoute = readFileSync("app/api/admin/products/[id]/visibility/route.ts", "utf8");
  const createRoute = readFileSync("app/api/admin/products/route.ts", "utf8");

  assert.match(updateRoute, /publicationReadinessRegressed/);
  assert.match(updateRoute, /createProductVisibilityUndoToken/);
  assert.match(visibilityRoute, /requirePublicationReadiness/);
  assert.match(createRoute, /getPublicationReadiness/);
  for (const source of [updateRoute, visibilityRoute, createRoute]) {
    assert.match(source, /publicationBlockedContract/);
    assert.match(source, /isSameOriginMutation/);
    assert.match(source, /hasProductWritePermission/);
  }
  assert.match(visibilityRoute, /verifyProductVisibilityUndoToken/);
});
