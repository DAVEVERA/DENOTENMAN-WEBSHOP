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
