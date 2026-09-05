import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const sectionsSource = readFileSync(
  join(
    process.cwd(),
    "app/admin/(dashboard)/zakelijk/[id]/BusinessAccountSections.tsx",
  ),
  "utf8",
);
const pageSource = readFileSync(
  join(process.cwd(), "app/admin/(dashboard)/zakelijk/[id]/page.tsx"),
  "utf8",
);

test("business account details use the requested accordion order", () => {
  const labels = [
    "Klantprofiel",
    "Contactgegevens & bedrijfsgegevens",
    "Levering & adressen",
    "Facturen",
    "Notities",
    "Persoonlijke uitnodiging",
    "Bestellijsten",
    "Gebeurtenissen",
  ];

  let previousIndex = -1;
  for (const label of labels) {
    const index = sectionsSource.indexOf(`title=\"${label}\"`);
    assert.ok(
      index > previousIndex,
      `${label} staat niet in de verwachte volgorde`,
    );
    previousIndex = index;
  }

  const statusIndex = sectionsSource.indexOf('title="Status"');
  assert.ok(
    statusIndex > previousIndex,
    "de statusbesturing staat niet in de laatste accordion",
  );
});

test("business account accordions have native keyboard semantics and mobile targets", () => {
  assert.match(sectionsSource, /<details/);
  assert.match(sectionsSource, /<summary/);
  assert.match(sectionsSource, /min-h-11/);
  assert.match(sectionsSource, /focus-visible:outline/);
  assert.match(sectionsSource, /\[&::-webkit-details-marker\]:hidden/);
  assert.match(sectionsSource, /Children\.toArray\(children\)/);
});

test("the page delegates all existing detail content to the accordion component", () => {
  assert.match(pageSource, /<BusinessAccountSections/);
  for (const slot of [
    "contactCompanyOverview",
    "deliveryOverview",
    "invoices",
    "personalInvitation",
    "orderLists",
    "events",
  ]) {
    assert.match(pageSource, new RegExp(`${slot}=`));
  }
  assert.doesNotMatch(pageSource, /STATUS_BADGE_CLASSES/);
});
