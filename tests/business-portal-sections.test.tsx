import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { BusinessPortalSection } from "../app/[locale]/zakelijk/BusinessPortalSection";

test("business portal sections use native accessible disclosure controls", () => {
  const markup = renderToStaticMarkup(
    <BusinessPortalSection title="Actuele bestellijst" description="Pas aantallen aan." defaultOpen>
      <p>Inhoud</p>
    </BusinessPortalSection>,
  );

  assert.match(markup, /^<details open=""/);
  assert.match(markup, /<summary/);
  assert.match(markup, /min-h-11/);
  assert.match(markup, /focus-visible:ring-2/);
  assert.match(markup, /Actuele bestellijst/);
  assert.match(markup, /Pas aantallen aan\./);
});

test("customer portal keeps current lists open and secondary areas collapsed", () => {
  const source = readFileSync("app/[locale]/zakelijk/BusinessPortalClient.tsx", "utf8");

  assert.match(source, /title="Bedrijfs- en factuurgegevens"/);
  assert.match(source, /<BusinessLogoSettings\s*\/>/);
  assert.match(source, /title="Wachtwoord en beveiliging"/);
  assert.match(source, /<details open=\{listActive \|\| list\.paymentPending\}/);
  assert.match(source, /compact title="Notities"/);
  assert.match(source, /compact title="Eerdere bestellingen"/);
  assert.match(source, /<details className="group\/order-history/);
  assert.match(source, /Factuur downloaden \(PDF\)/);
  assert.match(source, /Bestelling aanpassen of annuleren/);
});

test("the order-list section renders above the account/security sections", () => {
  const source = readFileSync("app/[locale]/zakelijk/BusinessPortalClient.tsx", "utf8");

  const orderListsIndex = source.indexOf("business-order-lists-heading");
  const accountSectionIndex = source.indexOf('title="Bedrijfs- en factuurgegevens"');
  assert.ok(orderListsIndex > -1 && accountSectionIndex > -1);
  assert.ok(orderListsIndex < accountSectionIndex, "order lists must render before the account settings sections");
});

test("the welcome heading is doubled in size and the order-list header uses the brand accent color", () => {
  const source = readFileSync("app/[locale]/zakelijk/BusinessPortalClient.tsx", "utf8");

  assert.match(source, /text-2xl font-bold uppercase tracking-\[0\.15em\] text-accent-ink">Welkom /);
  assert.match(source, /bg-accent p-4 text-left outline-none marker:content-none/);
  assert.doesNotMatch(source, /FFF9DA/);
});

test("the pickup-day calendar renders as its own card outside the collapsible order-list article", () => {
  const source = readFileSync("app/[locale]/zakelijk/BusinessPortalClient.tsx", "utf8");

  const articleCloseIndex = source.indexOf("</article>");
  const pickupCalendarIndex = source.indexOf("<PickupDayCalendar");
  assert.ok(articleCloseIndex > -1 && pickupCalendarIndex > -1);
  assert.ok(pickupCalendarIndex > articleCloseIndex, "PickupDayCalendar must render after the order-list article closes");
});

test("the pickup-day calendar is width-constrained so it stays readable on wide screens", () => {
  const source = readFileSync("components/business-portal/PickupDayCalendar.tsx", "utf8");

  assert.match(source, /className="max-w-sm rounded-panel border border-border bg-surface p-4"/);
});
