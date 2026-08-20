import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CloudCostsDashboard } from "../components/admin-panel/CloudCostsDashboard";

test("cloud costs dashboard exposes periods, totals and accessible detail tables", () => {
  const html = renderToStaticMarkup(<CloudCostsDashboard />);

  assert.match(html, /Google Cloud-kosten/);
  assert.match(html, />7 dagen</);
  assert.match(html, />30 dagen</);
  assert.match(html, />90 dagen</);
  assert.match(html, /Bruto kosten/);
  assert.match(html, /Credits/);
  assert.match(html, /Netto kosten/);
  assert.match(html, /Kosten per actieve dienst/);
  assert.match(html, /Dagelijks verloop/);
  assert.match(html, /aria-live="polite"/);
});
