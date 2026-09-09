import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { designStudioModules } from "../lib/design-studio/modules";

const navSource = readFileSync(join(process.cwd(), "components/admin-panel/AdminNav.tsx"), "utf8");

test("admin navigation keeps five primary destinations and grouped secondary destinations", () => {
  for (const label of ["Dashboard", "Producten", "Bestellingen", "Design Studio", "Marketing"]) {
    assert.match(navSource, new RegExp(`label: \\\"${label}\\\"`));
  }
  for (const group of ["Verkoop", "Catalogus", "Groei", "Creatie", "Beheer"]) {
    assert.match(navSource, new RegExp(`label: \\\"${group}\\\"`));
  }
  assert.doesNotMatch(navSource, /overflow-x-auto/);
});

test("admin menus expose active state, escape handling, focus restoration and 44px targets", () => {
  assert.match(navSource, /aria-current=/);
  assert.match(navSource, /event\.key !== "Escape"/);
  assert.match(navSource, /mobileButtonRef\.current\?\.focus/);
  assert.match(navSource, /moreButtonRef\.current\?\.focus/);
  assert.match(navSource, /min-h-11/);
  assert.match(navSource, /aria-controls="admin-mobile-menu"/);
});

test("the Design Studio registry is extensible and product photos are active", () => {
  const productPhotos = designStudioModules.find((module) => module.id === "product-photos");
  assert.equal(productPhotos?.status, "ACTIVE");
  assert.equal(productPhotos?.href, "/admin/design-studio/productfotos");
  const campaignImages = designStudioModules.find((module) => module.id === "campaign-assets");
  assert.equal(campaignImages?.status, "ACTIVE");
  assert.equal(campaignImages?.provider, "VModel");
  assert.equal(campaignImages?.href, "/admin/design-studio/campagnebeelden");
  const copywriter = designStudioModules.find((module) => module.id === "copywriter");
  assert.equal(copywriter?.status, "ACTIVE");
  assert.equal(copywriter?.provider, "Gemini");
  assert.equal(copywriter?.href, "/admin/design-studio/copywriter");
  assert.ok(designStudioModules.some((module) => module.status === "PLANNED"));
});
