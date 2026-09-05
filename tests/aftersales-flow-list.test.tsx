import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AftersalesFlowList, type AftersalesFlowSummary } from "../app/admin/(dashboard)/marketing/aftersales/AftersalesFlowList";

const flows: AftersalesFlowSummary[] = [
  { id: "flow-p", name: "Particulier", flowType: "PARTICULIER", isActive: true, stepCount: 3, updatedAt: "2026-09-01T10:00:00.000Z" },
  { id: "flow-z", name: "Zakelijk", flowType: "ZAKELIJK", isActive: false, stepCount: 2, updatedAt: "2026-09-02T10:00:00.000Z" },
];

test("renders one card per flow with its badge, active state and step count", () => {
  const html = renderToStaticMarkup(<AftersalesFlowList flows={flows} />);
  assert.match(html, /Particulier/);
  assert.match(html, /Zakelijk/);
  assert.match(html, /Actief/);
  assert.match(html, /Inactief/);
  assert.match(html, /3 mailstappen/);
  assert.match(html, /2 mailstappen/);
  assert.match(html, /href="\/admin\/marketing\/aftersales\/flow-p"/);
  assert.match(html, /href="\/admin\/marketing\/aftersales\/flow-z"/);
});

test("singular step count reads 'mailstap' not 'mailstappen'", () => {
  const html = renderToStaticMarkup(
    <AftersalesFlowList flows={[{ id: "flow-1", name: "Test", flowType: "PARTICULIER", isActive: true, stepCount: 1, updatedAt: "2026-09-01T10:00:00.000Z" }]} />
  );
  assert.match(html, /1 mailstap(?!pen)/);
});
