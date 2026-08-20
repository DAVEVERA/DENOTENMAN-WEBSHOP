import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CloudCostsDashboard,
  formatCloudCostMoney,
} from "../components/admin-panel/CloudCostsDashboard";

test("cloud cost currency formatting does not show negative zero", () => {
  assert.equal(formatCloudCostMoney(-0.000001), "€ 0,00");
  assert.equal(formatCloudCostMoney(-0.0001), "€ -0,0001");
});

test("cloud costs dashboard exposes account coverage, actual totals and detail tables", () => {
  const html = renderToStaticMarkup(<CloudCostsDashboard />);

  assert.match(html, /Google Cloud-kosten/);
  assert.match(html, />7 dagen</);
  assert.match(html, />30 dagen</);
  assert.match(html, />90 dagen</);
  assert.match(html, /Lijstkosten/);
  assert.match(html, /Kortingen en verschil/);
  assert.match(html, /Werkelijk gefactureerd/);
  assert.match(html, /Datadekking/);
  assert.match(html, /Alle billingaccounts/);
  assert.match(html, /Kosten per dienst/);
  assert.match(html, /Kosten per project/);
  assert.match(html, /Dagelijks verloop/);
  assert.match(html, /aria-live="polite"/);
});
