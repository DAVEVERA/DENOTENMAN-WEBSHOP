import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { BarChart, FunnelChart, KpiChart, TimeSeriesChart } from "../components/admin-panel/dashboard/Charts";
import { ChartPlaceholder } from "../components/admin-panel/dashboard/ChartFrame";
import { describeChange } from "../lib/dashboard/format";
import type { ChartData } from "../lib/dashboard/series";

const plain = (markup: string) => markup.replace(/ /gu, " ");
const text = (markup: string) => plain(markup).replace(/<[^>]+>/gu, " ").replace(/\s+/gu, " ").trim();

const revenue: ChartData = {
  categories: ["01-10", "02-10", "03-10"],
  series: [{
    key: "netRevenue",
    label: "Netto omzet",
    format: "euro",
    points: [{ label: "01-10", value: 100 }, { label: "02-10", value: null }, { label: "03-10", value: 250, partial: true }],
  }],
};

test("a chart is a figure with a caption that says what it shows", () => {
  const markup = renderToStaticMarkup(<TimeSeriesChart data={revenue} title="Omzet per dag" periodLabel="laatste 3 dagen" />);
  assert.match(markup, /<figure/u, "the drawing is a figure");
  assert.match(markup, /<figcaption[^>]*class="sr-only"/u, "the sentence is available to a screen reader");
  const caption = text(markup);
  assert.match(caption, /Omzet per dag/u);
  assert.match(caption, /van € 100,00 tot € 250,00/u);
  assert.match(caption, /1 van de 3 punten is niet gemeten/u);
  assert.match(markup, /aria-labelledby/u);
  assert.match(markup, /aria-hidden="true"/u, "the bars themselves are decorative");
});

test("every chart also offers the same numbers as a table and as CSV", () => {
  const markup = plain(renderToStaticMarkup(<TimeSeriesChart data={revenue} title="Omzet per dag" />));
  assert.match(markup, /Toon als tabel/u);
  assert.match(markup, /aria-expanded="false"/u);
  assert.match(markup, /aria-controls="/u);
  assert.match(markup, /<caption class="sr-only">Omzet per dag als tabel<\/caption>/u);
  assert.match(markup, /<th scope="col"[^>]*>Periode<\/th>/u);
  assert.match(markup, /<th scope="row"[^>]*>01-10<\/th>/u);
  assert.match(markup, /€ 100,00/u);
  assert.match(markup, /—/u, "the unmeasured day is a dash in the table, not a zero");
  assert.match(markup, />CSV</u);
});

test("the buttons under a chart are reachable and big enough to tap", () => {
  const markup = renderToStaticMarkup(<TimeSeriesChart data={revenue} title="Omzet" />);
  const buttons = markup.match(/<button[^>]*>/gu) ?? [];
  assert.equal(buttons.length, 2, "toggle and download");
  for (const button of buttons) {
    assert.match(button, /type="button"/u);
    assert.match(button, /min-h-11/u, "at least 44 pixels high");
    assert.match(button, /focus-visible:outline/u, "focus is visible");
  }
});

test("a trend is told in words and with an arrow, not only in colour", () => {
  const up = renderToStaticMarkup(<KpiChart value={1210.5} format="euro" change={describeChange(1210.5, 1000, "euro")} />);
  assert.match(text(up), /€ 1\.210,50/u);
  assert.match(text(up), /\+21,1% tegenover vorige periode/u);
  assert.match(up, /<svg/u, "an arrow carries the direction too");

  const flat = renderToStaticMarkup(<KpiChart value={100} change={describeChange(100, 100)} />);
  assert.match(text(flat), /gelijk aan vorige periode/u);

  const unmeasured = renderToStaticMarkup(<KpiChart value={null} />);
  assert.match(text(unmeasured), /—/u);
  assert.doesNotMatch(text(unmeasured), /\b0\b/u, "nothing measured never reads as zero");
});

test("a funnel names the drop-off per step and warns when it counts events", () => {
  const steps = [
    { label: "Productweergave", value: 1000 },
    { label: "In winkelwagen", value: 250 },
    { label: "Betaald", value: 100 },
  ];
  const honest = text(renderToStaticMarkup(<FunnelChart steps={steps} title="Funnel" comparable={false} />));
  assert.match(honest, /1\. Productweergave/u);
  assert.match(honest, /−75%/u, "the drop-off is shown, not just the total");
  assert.match(honest, /tellen gebeurtenissen, niet unieke bezoekers/u);

  const reliable = text(renderToStaticMarkup(<FunnelChart steps={steps} title="Funnel" comparable />));
  assert.doesNotMatch(reliable, /tellen gebeurtenissen/u);
  assert.match(reliable, /uitval 75%/u, "the caption still states it");
});

test("a bar chart labels every bar with its own value", () => {
  const data: ChartData = {
    categories: ["Noten", "Gedroogd fruit", "Honing"],
    series: [{ key: "revenue", label: "Omzet", format: "euro", points: [{ label: "Noten", value: 900 }, { label: "Gedroogd fruit", value: 400 }, { label: "Honing", value: null }] }],
  };
  const horizontal = text(renderToStaticMarkup(<BarChart data={data} title="Omzet per categorie" />));
  assert.match(horizontal, /Noten € 900,00/u);
  assert.match(horizontal, /Honing —/u);
  const vertical = text(renderToStaticMarkup(<BarChart data={data} title="Omzet per categorie" direction="vertical" />));
  assert.match(vertical, /€ 400,00/u);
});

test("the five empty states say five different things", () => {
  const seen = new Set<string>();
  for (const state of ["loading", "empty", "not_measured", "error"] as const) {
    const markup = renderToStaticMarkup(<ChartPlaceholder state={state} />);
    seen.add(text(markup));
  }
  assert.equal(seen.size, 4, "each state has its own wording");
  assert.match(renderToStaticMarkup(<ChartPlaceholder state="error" />), /role="alert"/u);
  assert.match(text(renderToStaticMarkup(<ChartPlaceholder state="not_measured" />)), /Nog niet gemeten/u);
  assert.match(text(renderToStaticMarkup(<ChartPlaceholder state="empty" />)), /Geen gegevens in deze periode/u);
  assert.match(text(renderToStaticMarkup(<TimeSeriesChart data={{ categories: [], series: [] }} title="Leeg" />)), /Geen gegevens/u);
});
