import assert from "node:assert/strict";
import test from "node:test";
import {
  getApexScanPage,
  getApexScanSummary,
} from "../lib/price-monitor/apex-scan";

test("the supplied APEX snapshot is counted without turning rows into price actions", () => {
  const summary = getApexScanSummary();

  assert.equal(summary.scraperFile, "app/admin/(dashboard)/prijsmonitor/apex.py");
  assert.equal(summary.listedSources, 19);
  assert.equal(summary.sourcesWithResults, 9);
  assert.equal(summary.productCount, 900);
  assert.equal(summary.priceRowCount, 1419);
  assert.equal(summary.rowsWithSku, 922);
  assert.equal(summary.rowsWithPackage, 0);
  assert.equal(summary.readyForComparisonRows, 0);
  assert.equal(summary.invalidPriceRows, 3);
  assert.equal(summary.suspectHighPriceRows, 75);
});

test("APEX results are paged, source-filtered and marked for human review", () => {
  const basBoer = getApexScanPage({ source: "basboernoten.nl", limit: 100 });

  assert.equal(basBoer.total, 15);
  assert.equal(basBoer.items.length, 15);
  assert.ok(basBoer.items.every((item) => item.domain === "basboernoten.nl"));
  assert.ok(basBoer.items.every((item) => item.safeForComparison === false));
  assert.ok(
    basBoer.items.every((item) => item.qualityIssues.includes("Gewicht ontbreekt"))
  );

  const pistachio = getApexScanPage({ query: "pistache", limit: 10 });
  assert.ok(pistachio.total > 0);
  assert.ok(pistachio.items.length <= 10);
  assert.ok(
    pistachio.items.every((item) =>
      `${item.productName} ${item.variantName}`.toLocaleLowerCase("nl-NL").includes("pistache")
    )
  );
});

test("APEX pagination is bounded and only exposes source-owned product URLs", () => {
  const page = getApexScanPage({ limit: 999, offset: -10 });

  assert.equal(page.limit, 100);
  assert.equal(page.offset, 0);
  assert.equal(page.items.length, 100);
  for (const item of page.items) {
    if (!item.productUrl) continue;
    const url = new URL(item.productUrl);
    assert.ok(
      url.hostname === item.domain || url.hostname.endsWith(`.${item.domain}`)
    );
  }
});
