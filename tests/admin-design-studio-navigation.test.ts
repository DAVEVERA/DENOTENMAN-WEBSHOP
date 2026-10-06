import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { designStudioModules } from "../lib/design-studio/modules";

const navSource = readFileSync(join(process.cwd(), "components/admin-panel/AdminNav.tsx"), "utf8");

test("admin navigation groups its destinations: Catalogus, Bestellingen, Marketing and Beheer", () => {
  for (const label of ["Dashboard", "Catalogus", "Bestellingen", "Design Studio", "Marketing", "Beheer"]) {
    assert.match(navSource, new RegExp(`label: \\"${label}\\"`));
  }
  for (const [href, label] of [
    ["/admin/producten", "Producten"],
    ["/admin/categorieen", "Categorieën"],
    ["/admin/bestellingen", "Particuliere bestellingen"],
    ["/admin/zakelijk", "Zakelijke bestellijsten"],
    ["/admin/kortingen", "Kortingen"],
    ["/admin/facturen", "Facturen"],
    ["/admin/ontwikkelaarsfacturen", "Facturen ontwikkelaar"],
    ["/admin/instellingen", "Instellingen"],
    ["/admin/logboek", "Logboek"],
  ]) {
    assert.match(navSource, new RegExp(`href: "${href}", label: "${label}"`));
  }
  // Facturen and developer invoices sit together under the Financieel heading in Beheer.
  assert.match(navSource, /heading: "Financieel", items: \[\{ href: "\/admin\/facturen".*\/admin\/ontwikkelaarsfacturen/);
  // Subscriptions are removed from the menu, and Kortingen no longer sits under Verkoop.
  assert.doesNotMatch(navSource, /abonnementen|Verkoop/);
  assert.doesNotMatch(navSource, /overflow-x-auto/);
});

test("Google Ads and QR codes live under Marketing; the removed tools are gone", () => {
  const marketingHub = readFileSync(join(process.cwd(), "app/admin/(dashboard)/marketing/page.tsx"), "utf8");
  assert.match(marketingHub, /href: "\/admin\/marketing\/advertenties"/);
  assert.match(marketingHub, /href: "\/admin\/marketing\/qrcodes"/);
  for (const removed of ["/admin/advertenties", "/admin/qrcodes", "/admin/prijsmonitor", "/admin/notenplan"]) {
    assert.doesNotMatch(navSource, new RegExp(`"${removed}"`));
  }
  const nextConfig = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");
  assert.match(nextConfig, /source: "\/admin\/advertenties", destination: "\/admin\/marketing\/advertenties"/);
  assert.match(nextConfig, /source: "\/admin\/qrcodes\/:path\*", destination: "\/admin\/marketing\/qrcodes\/:path\*"/);
});

test("admin menus expose active state, escape handling, focus restoration and 44px targets", () => {
  assert.match(navSource, /aria-current=/);
  assert.match(navSource, /event\.key !== "Escape"/);
  assert.match(navSource, /mobileButtonRef\.current\?\.focus/);
  assert.match(navSource, /groupButtonRefs\.current\[openGroup\]\?\.focus/);
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
