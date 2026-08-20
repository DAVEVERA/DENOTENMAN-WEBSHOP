import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CloudCostsDashboard,
  formatCloudCostMoney,
  formatManagedCostMoney,
} from "../components/admin-panel/CloudCostsDashboard";

test("cloud cost currency formatting does not show negative zero", () => {
  assert.equal(formatCloudCostMoney(-0.000001), "€ 0,00");
  assert.equal(formatCloudCostMoney(-0.0001), "€ -0,0001");
});

test("unknown managed costs are never presented as zero", () => {
  assert.equal(formatManagedCostMoney(null), "Bedrag nog vastleggen");
  assert.equal(formatManagedCostMoney(0), "€ 0,00");
});

test("cost overview presents the consolidated bill and managed cost sections", () => {
  const html = renderToStaticMarkup(<CloudCostsDashboard />);

  assert.match(html, /Kostenoverzicht/);
  assert.match(html, />7 dagen</);
  assert.match(html, />30 dagen</);
  assert.match(html, />90 dagen</);
  assert.match(html, /the nutty bill/);
  assert.match(html, /Werkelijk gefactureerd/);
  assert.doesNotMatch(html, /Lijstkosten/);
  assert.doesNotMatch(html, /Kortingen en verschil/);
  assert.doesNotMatch(html, /Datadekking/);
  assert.doesNotMatch(html, /Alle billingaccounts/);
  assert.doesNotMatch(html, />Projecten</);
  assert.doesNotMatch(html, />Billingaccount</);
  assert.match(html, /Kosten per dienst/);
  assert.doesNotMatch(html, /Kosten per project/);
  assert.match(html, /Dagelijks verloop/);
  assert.match(html, /Beheerkosten/);
  assert.match(html, /Facturen/);
  assert.match(html, /PhotoRoom/);
  assert.match(html, /Prisma/);
  assert.doesNotMatch(html, /Kostenpost toevoegen/);
  assert.doesNotMatch(html, /Factuur uploaden/);
  assert.doesNotMatch(html, /overflow-x-auto/);
  assert.doesNotMatch(html, /min-w-\[/);
  assert.match(html, /aria-live="polite"/);
});
