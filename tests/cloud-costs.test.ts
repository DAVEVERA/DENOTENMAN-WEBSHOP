import assert from "node:assert/strict";
import test from "node:test";
import {
  CloudCostsConfigurationError,
  buildCloudCostsQuery,
  cloudCostsConfiguration,
  normalizeCloudCostRows,
  parseCloudCostDays,
} from "../lib/cloud-costs";

const originalEnvironment = {
  project: process.env.GCP_BILLING_EXPORT_PROJECT_ID,
  dataset: process.env.GCP_BILLING_EXPORT_DATASET_ID,
  table: process.env.GCP_BILLING_EXPORT_TABLE_ID,
  billedProject: process.env.GCP_BILLING_QUERY_PROJECT_ID,
};

test.afterEach(() => {
  for (const [name, value] of Object.entries({
    GCP_BILLING_EXPORT_PROJECT_ID: originalEnvironment.project,
    GCP_BILLING_EXPORT_DATASET_ID: originalEnvironment.dataset,
    GCP_BILLING_EXPORT_TABLE_ID: originalEnvironment.table,
    GCP_BILLING_QUERY_PROJECT_ID: originalEnvironment.billedProject,
  })) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

test("accepts supported periods and falls back to 30 days", () => {
  assert.equal(parseCloudCostDays("7"), 7);
  assert.equal(parseCloudCostDays("90"), 90);
  assert.equal(parseCloudCostDays("31"), 30);
  assert.equal(parseCloudCostDays(null), 30);
});

test("requires safe BigQuery identifiers for the billing export", () => {
  process.env.GCP_BILLING_EXPORT_PROJECT_ID = "project-5dc79156-4200-4528-bfc";
  process.env.GCP_BILLING_EXPORT_DATASET_ID = "cloud_billing_export";
  process.env.GCP_BILLING_EXPORT_TABLE_ID = "gcp_billing_export_v1_016DC8_5772EF_E4A1AF";
  delete process.env.GCP_BILLING_QUERY_PROJECT_ID;

  assert.deepEqual(cloudCostsConfiguration(), {
    exportProjectId: "project-5dc79156-4200-4528-bfc",
    datasetId: "cloud_billing_export",
    tableId: "gcp_billing_export_v1_016DC8_5772EF_E4A1AF",
    queryProjectId: "project-5dc79156-4200-4528-bfc",
    sourceTable:
      "project-5dc79156-4200-4528-bfc.cloud_billing_export.gcp_billing_export_v1_016DC8_5772EF_E4A1AF",
  });

  process.env.GCP_BILLING_EXPORT_TABLE_ID = "table`; DROP TABLE x; --";
  assert.throws(
    () => cloudCostsConfiguration(),
    (error: unknown) =>
      error instanceof CloudCostsConfigurationError && error.code === "INVALID_CONFIGURATION"
  );
});

test("builds a bounded parameterized cost query", () => {
  const request = buildCloudCostsQuery({
    sourceTable: "project-5dc79156-4200-4528-bfc.cloud_billing_export.gcp_billing_export_v1_123",
    cloudProjectId: "project-5dc79156-4200-4528-bfc",
    days: 30,
    now: new Date("2026-08-20T12:00:00.000Z"),
  });

  assert.match(request.query, /project\.id = @cloudProjectId/);
  assert.match(request.query, /usage_start_time >= @from/);
  assert.match(request.query, /UNNEST\(credits\)/);
  assert.doesNotMatch(request.query, /2026-08-20/);
  assert.equal(request.parameters.cloudProjectId, "project-5dc79156-4200-4528-bfc");
  assert.equal(request.parameters.from, "2026-07-22T00:00:00.000Z");
  assert.equal(request.parameters.to, "2026-08-21T00:00:00.000Z");
});

test("normalizes BigQuery rows into totals, services and a complete daily series", () => {
  const result = normalizeCloudCostRows({
    days: 7,
    from: "2026-08-18T00:00:00.000Z",
    to: "2026-08-25T00:00:00.000Z",
    rows: [
      { usage_date: "2026-08-18", service_id: "run", service_name: "Cloud Run", gross_cost: "4.5", credits: "-1", net_cost: "3.5", currency: "EUR", latest_usage_at: "2026-08-18T23:00:00Z" },
      { usage_date: "2026-08-20", service_id: "storage", service_name: "Cloud Storage", gross_cost: "2", credits: "0", net_cost: "2", currency: "EUR", latest_usage_at: "2026-08-20T10:00:00Z" },
      { usage_date: "2026-08-20", service_id: "run", service_name: "Cloud Run", gross_cost: "1", credits: "-0.25", net_cost: "0.75", currency: "EUR", latest_usage_at: "2026-08-20T11:00:00Z" },
    ],
  });

  assert.deepEqual(result.summary, { grossCost: 7.5, credits: -1.25, netCost: 6.25 });
  assert.deepEqual(result.services.map((service) => [service.name, service.netCost]), [
    ["Cloud Run", 4.25],
    ["Cloud Storage", 2],
  ]);
  assert.equal(result.daily.length, 7);
  assert.deepEqual(result.daily.slice(0, 3).map((day) => [day.date, day.netCost]), [
    ["2026-08-18", 3.5],
    ["2026-08-19", 0],
    ["2026-08-20", 2.75],
  ]);
  assert.equal(result.currency, "EUR");
  assert.equal(result.latestUsageAt, "2026-08-20T11:00:00.000Z");
});
