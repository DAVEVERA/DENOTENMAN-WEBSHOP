import assert from "node:assert/strict";
import test from "node:test";
import {
  MIGRATION_STATUSES,
  type ProductImageMigrationReport,
  type ProductImageMigrationResult,
  renderMigrationReportCsv,
  renderMigrationReportJson,
  renderMigrationReviewHtml,
} from "../lib/product-image-migration/report";

function result(
  index: number,
  overrides: Partial<ProductImageMigrationResult> = {},
): ProductImageMigrationResult {
  return {
    productId: `product-${index}`,
    imageId: `image-${index}`,
    name: `Product ${index}`,
    slug: `product-${index}`,
    originalUrl: `https://images.example.test/original-${index}.jpg`,
    status: "success",
    previewUrl: `https://images.example.test/preview-${index}.webp`,
    detection: {
      centerX: 500,
      centerY: 501,
      radius: 410,
      confidence: 0.96,
      candidateCount: 1,
    },
    ...overrides,
  } as ProductImageMigrationResult;
}

function report(results: readonly ProductImageMigrationResult[]): ProductImageMigrationReport {
  return {
    generatedAt: "2026-08-20T10:00:00.000Z",
    processingVersion: "v1",
    runId: "run-2026-08-20",
    dryRun: true,
    results,
  };
}

test("uses one fixed status vocabulary across report formats", () => {
  assert.deepEqual(MIGRATION_STATUSES, [
    "success",
    "skipped",
    "needs_manual_review",
    "failed",
  ]);

  const results: ProductImageMigrationResult[] = [
    result(1),
    result(2, { status: "skipped", reason: "Al verwerkt", previewUrl: undefined }),
    result(3, {
      status: "needs_manual_review",
      reason: "Detectie onzeker",
      previewUrl: undefined,
    }),
    result(4, { status: "failed", reason: "Upload mislukt", previewUrl: undefined }),
  ];
  const data = report(results);
  const json = renderMigrationReportJson(data);
  const csv = renderMigrationReportCsv(data);
  const html = renderMigrationReviewHtml(data);

  const parsed = JSON.parse(json) as ProductImageMigrationReport;
  assert.deepEqual(
    parsed.results.map((entry) => [entry.productId, entry.imageId, entry.status]),
    results.map((entry) => [entry.productId, entry.imageId, entry.status]),
  );

  for (const entry of results) {
    assert.match(csv, new RegExp(`${entry.status},${entry.productId},${entry.imageId}`));
    assert.match(html, new RegExp(`data-migration-card="${entry.productId}"`));
    assert.match(html, new RegExp(`data-image-id="${entry.imageId}"`));
    assert.match(html, new RegExp(`data-status="${entry.status}"`));
  }
});

test("renders deterministic readable JSON without mutating the report", () => {
  const data = report([result(1)]);
  const before = structuredClone(data);
  const first = renderMigrationReportJson(data);
  const second = renderMigrationReportJson(data);

  assert.equal(first, second);
  assert.match(first, /\n  "dryRun": true,/);
  assert.deepEqual(data, before);
});

test("quotes commas, quotes and newlines correctly in CSV", () => {
  const data = report([
    result(1, {
      name: 'Cashew, "premium"',
      slug: "cashew-premium",
      reason: "Regel een\nRegel twee",
    }),
  ]);
  const csv = renderMigrationReportCsv(data);

  assert.match(csv, /"Cashew, ""premium"""/);
  assert.match(csv, /"Regel een\nRegel twee"/);
  assert.equal(csv.endsWith("\r\n"), true);
});

test("neutralizes spreadsheet formula prefixes in CSV", () => {
  const csv = renderMigrationReportCsv(
    report([result(1, { name: "=HYPERLINK(\"https://example.test\")" })]),
  );
  assert.match(csv, /'=HYPERLINK/);
  assert.doesNotMatch(csv, /,=HYPERLINK/);
});

test("escapes all dynamic HTML and rejects unsafe image schemes", () => {
  const malicious = '<script>alert("x")</script><img src=x onerror=alert(1)>';
  const html = renderMigrationReviewHtml(
    report([
      result(1, {
        productId: `p-${malicious}`,
        imageId: `i-${malicious}`,
        name: malicious,
        slug: malicious,
        originalUrl: `javascript:${malicious}`,
        previewUrl: `data:text/html,${malicious}`,
        reason: malicious,
      }),
    ]),
  );

  assert.doesNotMatch(html, /<script[\s>]/i);
  assert.doesNotMatch(html, /<img\s+src=x/i);
  assert.doesNotMatch(html, /javascript:/i);
  assert.doesNotMatch(html, /data:text\/html/i);
  assert.match(html, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/);
  assert.match(html, /Geen veilige voorbeeldafbeelding beschikbaar/);
});

test("limits the local review to ten responsive cards", () => {
  const html = renderMigrationReviewHtml(
    report(Array.from({ length: 12 }, (_, index) => result(index + 1))),
    99,
  );

  assert.equal((html.match(/class="migration-card"/g) || []).length, 10);
  assert.doesNotMatch(html, /data-migration-card="product-11"/);
  assert.match(html, /@media \(min-width: 760px\)/);
  assert.match(html, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(html, /min-width: 320px/);
});

test("contains no mutating controls, scripts or programmatic network calls", () => {
  const html = renderMigrationReviewHtml(report([result(1)]));

  assert.doesNotMatch(html, /<(?:form|button|input|textarea|select)[\s>]/i);
  assert.doesNotMatch(html, /<script[\s>]/i);
  assert.doesNotMatch(html, /\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(/i);
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /form-action 'none'/);
});
