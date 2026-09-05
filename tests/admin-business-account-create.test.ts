import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const formSource = readFileSync(
  join(process.cwd(), "app/admin/(dashboard)/zakelijk/nieuw/BusinessAccountCreateForm.tsx"),
  "utf8",
);
const routeSource = readFileSync(
  join(process.cwd(), "app/api/admin/business-accounts/route.ts"),
  "utf8",
);
const schemaSource = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
const detailPageSource = readFileSync(
  join(process.cwd(), "app/admin/(dashboard)/zakelijk/[id]/page.tsx"),
  "utf8",
);
const detailSectionsSource = readFileSync(
  join(process.cwd(), "app/admin/(dashboard)/zakelijk/[id]/BusinessAccountSections.tsx"),
  "utf8",
);
const detailRouteSource = readFileSync(
  join(process.cwd(), "app/api/admin/business-accounts/[id]/route.ts"),
  "utf8",
);

test("new business account form groups the complete onboarding in accordions", () => {
  const sections = [
    "Klant en contact",
    "Bedrijfsregistratie",
    "Levering en afhalen",
    "Logo en nieuwsbrief",
    "Opmerkingen",
  ];

  let previous = -1;
  for (const section of sections) {
    const index = formSource.indexOf(`title="${section}"`);
    assert.ok(index > previous, `${section} is missing or out of order`);
    previous = index;
  }
  assert.match(formSource, /<details/);
  assert.match(formSource, /<summary/);
  assert.match(formSource, /defaultOpen/);
  assert.match(formSource, /min-h-11/);
});

test("new account payload covers registration, addresses, pickup, newsletter, notes and logo", () => {
  for (const name of [
    "kvkNumber",
    "vatNumber",
    "peppolConfigured",
    "peppolParticipantId",
    "fixedPickupLocationId",
    "pickupFrequency",
    "businessNewsletterOptIn",
    "notes",
  ]) {
    assert.match(formSource, new RegExp(`name="${name}"`), `${name} input missing`);
    assert.match(routeSource, new RegExp(`${name}:`), `${name} API contract missing`);
  }
  assert.match(formSource, /name={`\$\{prefix\}Street`}/, "reusable address street input missing");
  assert.match(formSource, /prefix="shipping"/, "shipping address fields missing");
  assert.match(formSource, /prefix="billing"/, "billing address fields missing");
  assert.match(routeSource, /shippingStreet:/);
  assert.match(routeSource, /billingStreet:/);
  assert.match(formSource, /accept="image\/png,image\/jpeg,image\/webp"/);
  assert.match(formSource, /formData\.append\("payload"/);
  assert.match(routeSource, /normalizeBusinessLogo/);
  assert.match(routeSource, /saveImmutableProductAsset/);
  assert.match(routeSource, /deleteProductAsset/);
});

test("business account schema stores the new onboarding preferences additively", () => {
  assert.match(schemaSource, /fixedPickupLocationId\s+String\?/);
  assert.match(schemaSource, /pickupFrequency\s+BusinessPickupFrequency\?/);
  assert.match(schemaSource, /businessNewsletterOptIn\s+Boolean/);
  assert.match(schemaSource, /businessNewsletterConsentAt\s+DateTime\?/);
});

test("pickup agreements stay visible and editable in the customer dossier", () => {
  assert.match(detailPageSource, /Vaste afhaallocatie/);
  assert.match(detailPageSource, /Zakelijke nieuwsbrief/);
  assert.match(detailSectionsSource, /currentFixedPickupLocationId/);
  assert.match(detailSectionsSource, /fixedPickupLocationId: fixedPickupLocationId \|\| null/);
  assert.match(detailSectionsSource, /pickupFrequency: pickupFrequency \|\| null/);
  assert.match(detailRouteSource, /fixedPickupLocationId: z\.enum/);
  assert.match(detailRouteSource, /pickupFrequency: z\.enum/);
});
