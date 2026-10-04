import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("the order API rejects pickup tracking while allowing pickup fulfilment without it", () => {
  const route = source("app/api/admin/orders/[id]/route.ts");

  assert.match(route, /TRACKING_NOT_ALLOWED/);
  assert.match(route, /allowsPostnlForDeliveryMethod\(existing\.deliveryMethod\)/);
  assert.match(route, /requiresTrackingForFulfillment\(existing\.deliveryMethod\)/);
  assert.match(route, /TRACKING_CODE_REQUIRED/);
  assert.match(route, /getAdminSession/);
  assert.match(route, /can\(admin\.role, "orders", "write"\)/);
  assert.match(route, /isSameOriginMutation/);
});

test("the admin order UI exposes PostNL only for shipping and keeps pickup fulfilment available", () => {
  const list = source("app/admin/(dashboard)/bestellingen/page.tsx");
  const detail = source("app/admin/(dashboard)/bestellingen/[id]/page.tsx");
  const form = source("app/admin/(dashboard)/bestellingen/[id]/OrderEditForm.tsx");

  assert.match(list, /deliveryMethod: true/);
  assert.match(list, /order\.deliveryMethod === "SHIPPING"/);
  assert.match(detail, /deliveryMethod=\{order\.deliveryMethod\}/);
  assert.match(form, /const isShipping = deliveryMethod === "SHIPPING"/);
  assert.match(form, /currentStatus === "PAID"[\s\S]*!isShipping \|\| savedTrackingCode\.trim\(\)\.length > 0/);
  assert.match(form, /Markeer als afgehaald/);
  assert.match(form, /\{isShipping \? \(/);
});

test("order date presets use the Amsterdam calendar instead of UTC or the host timezone", () => {
  for (const path of [
    "app/admin/(dashboard)/bestellingen/BulkLabelPrint.tsx",
    "app/admin/(dashboard)/bestellingen/BulkPakbonPrint.tsx",
    "app/admin/(dashboard)/bestellingen/MarketManifestPrint.tsx",
  ]) {
    const ui = source(path);
    assert.match(ui, /formatAmsterdamCalendarDate/);
    assert.match(ui, /shiftAmsterdamCalendarDate/);
    assert.doesNotMatch(ui, /toISOString\(\)\.slice\(0, 10\)/);
  }
});
