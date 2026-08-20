import assert from "node:assert/strict";
import test from "node:test";
import {
  CloudCostsConfigurationError,
  availableCloudCostSourceResults,
  buildCloudCostsQuery,
  cloudCostsConfiguration,
  normalizeCloudCostRows,
  parseBillingAccountCatalog,
  parseCloudCostDays,
  type CloudBillingExportSource,
  type CloudCostRow,
} from "../lib/cloud-costs";

const environmentNames = [
  "GCP_BILLING_EXPORT_PROJECT_ID",
  "GCP_BILLING_EXPORT_DATASET_ID",
  "GCP_BILLING_EXPORT_TABLE_ID",
  "GCP_BILLING_QUERY_PROJECT_ID",
  "GCP_BILLING_ACCOUNT_ID",
  "GCP_BILLING_EXPORT_FORMAT",
  "GCP_BILLING_EXPORT_LOCATION",
  "GCP_BILLING_EXPORT_SOURCES_JSON",
  "GCP_BILLING_ACCOUNTS_JSON",
] as const;
const originalEnvironment = Object.fromEntries(
  environmentNames.map((name) => [name, process.env[name]])
);

test.afterEach(() => {
  for (const name of environmentNames) {
    const value = originalEnvironment[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

function focusSource(): CloudBillingExportSource {
  return {
    billingAccountId: "016DC8-5772EF-E4A1AF",
    projectId: "denotenman",
    datasetId: "gcp_billing_immutable_016DC8_5772EF_E4A1AF_eu",
    tableId: "gcp_billing_export_focus_016DC8_5772EF_E4A1AF",
    queryProjectId: "project-5dc79156-4200-4528-bfc",
    format: "FOCUS",
    location: "EU",
    sourceTable:
      "denotenman.gcp_billing_immutable_016DC8_5772EF_E4A1AF_eu.gcp_billing_export_focus_016DC8_5772EF_E4A1AF",
  };
}

function row(overrides: Partial<CloudCostRow> = {}): CloudCostRow {
  return {
    coverage_only: false,
    billing_account_id: "016DC8-5772EF-E4A1AF",
    usage_date: "2026-08-18",
    project_id: "project-one",
    project_name: "Project One",
    service_id: "run",
    service_name: "Cloud Run",
    gross_cost: "4.5",
    credits: "-1",
    net_cost: "3.5",
    currency: "EUR",
    latest_usage_at: "2026-08-18T23:00:00Z",
    export_first_usage_at: "2026-05-01T00:00:00Z",
    export_latest_usage_at: "2026-08-20T11:00:00Z",
    ...overrides,
  };
}

test("accepts supported periods and falls back to 30 days", () => {
  assert.equal(parseCloudCostDays("7"), 7);
  assert.equal(parseCloudCostDays("90"), 90);
  assert.equal(parseCloudCostDays("31"), 30);
  assert.equal(parseCloudCostDays(null), 30);
});

test("infers a safe FOCUS export and billing account from legacy environment variables", () => {
  delete process.env.GCP_BILLING_EXPORT_SOURCES_JSON;
  delete process.env.GCP_BILLING_ACCOUNTS_JSON;
  process.env.GCP_BILLING_EXPORT_PROJECT_ID = "denotenman";
  process.env.GCP_BILLING_EXPORT_DATASET_ID = "gcp_billing_immutable_016DC8_5772EF_E4A1AF_eu";
  process.env.GCP_BILLING_EXPORT_TABLE_ID = "gcp_billing_export_focus_016DC8_5772EF_E4A1AF";
  process.env.GCP_BILLING_QUERY_PROJECT_ID = "project-5dc79156-4200-4528-bfc";

  assert.deepEqual(cloudCostsConfiguration(), {
    sources: [focusSource()],
    accountCatalog: [],
  });

  process.env.GCP_BILLING_EXPORT_TABLE_ID = "table`; DROP TABLE x; --";
  assert.throws(
    () => cloudCostsConfiguration(),
    (error: unknown) =>
      error instanceof CloudCostsConfigurationError && error.code === "INVALID_CONFIGURATION"
  );
});

test("supports multiple unique account exports and rejects duplicate account sources", () => {
  process.env.GCP_BILLING_EXPORT_SOURCES_JSON = JSON.stringify([
    focusSource(),
    {
      billingAccountId: "01F7DB-1D6944-CA546F",
      projectId: "profainl",
      datasetId: "billing",
      tableId: "gcp_billing_export_v1_01F7DB_1D6944_CA546F",
      format: "STANDARD",
      location: "EU",
    },
  ]);
  const result = cloudCostsConfiguration();
  assert.equal(result.sources.length, 2);
  assert.equal(result.sources[1].queryProjectId, "profainl");

  process.env.GCP_BILLING_EXPORT_SOURCES_JSON = JSON.stringify([focusSource(), focusSource()]);
  assert.throws(
    () => cloudCostsConfiguration(),
    (error: unknown) =>
      error instanceof CloudCostsConfigurationError && error.code === "INVALID_CONFIGURATION"
  );
});

test("parses a bounded account catalog and rejects duplicate IDs", () => {
  assert.deepEqual(
    parseBillingAccountCatalog(
      JSON.stringify([{ id: "016DC8-5772EF-E4A1AF", displayName: "thenuttybill", open: true }])
    ),
    [{ id: "016DC8-5772EF-E4A1AF", displayName: "thenuttybill", open: true }]
  );
  assert.throws(() =>
    parseBillingAccountCatalog(
      JSON.stringify([
        { id: "016DC8-5772EF-E4A1AF", displayName: "One", open: true },
        { id: "016DC8-5772EF-E4A1AF", displayName: "Two", open: false },
      ])
    )
  );
});

test("builds a bounded FOCUS query for every project in the billing account", () => {
  const request = buildCloudCostsQuery({
    source: focusSource(),
    days: 30,
    now: new Date("2026-08-20T12:00:00.000Z"),
  });

  assert.match(request.query, /BillingAccountId = @billingAccountId/);
  assert.match(request.query, /BilledCost/);
  assert.match(request.query, /SubAccountId/);
  assert.doesNotMatch(request.query, /project\.id = @cloudProjectId/);
  assert.doesNotMatch(request.query, /2026-08-20/);
  assert.equal(request.parameters.billingAccountId, "016DC8-5772EF-E4A1AF");
  assert.equal(request.parameters.from, "2026-07-22T00:00:00.000Z");
  assert.equal(request.parameters.to, "2026-08-21T00:00:00.000Z");
});

test("normalizes actual account, project, service and daily costs without fake zero accounts", () => {
  const result = normalizeCloudCostRows({
    days: 7,
    from: "2026-08-18T00:00:00.000Z",
    to: "2026-08-25T00:00:00.000Z",
    accountDiscovery: "LIVE",
    accounts: [
      { id: "016DC8-5772EF-E4A1AF", displayName: "thenuttybill", open: true },
      { id: "01F7DB-1D6944-CA546F", displayName: "Firebase Payment", open: true },
    ],
    rows: [
      row(),
      row({
        usage_date: "2026-08-20",
        project_id: "project-two",
        project_name: "Project Two",
        service_id: "storage",
        service_name: "Cloud Storage",
        gross_cost: "2",
        credits: "0",
        net_cost: "2",
        latest_usage_at: "2026-08-20T10:00:00Z",
      }),
      row({
        usage_date: "2026-08-20",
        gross_cost: "1",
        credits: "-0.25",
        net_cost: "0.75",
        latest_usage_at: "2026-08-20T11:00:00Z",
      }),
      row({ coverage_only: true, usage_date: null, project_id: null, project_name: null, service_id: null, service_name: null, gross_cost: 0, credits: 0, net_cost: 0, latest_usage_at: null }),
    ],
  });

  assert.deepEqual(result.summary, { grossCost: 7.5, credits: -1.25, netCost: 6.25 });
  assert.deepEqual(result.coverage, { totalAccounts: 2, accountsWithExport: 1, accountsWithoutExport: 1 });
  assert.deepEqual(result.accounts.map((account) => [account.displayName, account.costStatus, account.netCost]), [
    ["Firebase Payment", "NO_EXPORT", null],
    ["thenuttybill", "AVAILABLE", 6.25],
  ]);
  assert.deepEqual(result.projects.map((project) => [project.name, project.netCost]), [
    ["Project One", 4.25],
    ["Project Two", 2],
  ]);
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
  assert.equal(result.latestUsageAt, "2026-08-20T11:00:00.000Z");
});

test("consolidates actual costs from every exported billing account into one total", () => {
  const result = normalizeCloudCostRows({
    days: 7,
    from: "2026-08-18T00:00:00.000Z",
    to: "2026-08-25T00:00:00.000Z",
    accountDiscovery: "LIVE",
    accounts: [
      { id: "016DC8-5772EF-E4A1AF", displayName: "thenuttybill", open: true },
      { id: "01F7DB-1D6944-CA546F", displayName: "Firebase Payment", open: true },
    ],
    rows: [
      row({ gross_cost: "4.5", credits: "-1", net_cost: "3.5" }),
      row({
        billing_account_id: "01F7DB-1D6944-CA546F",
        project_id: "project-two",
        project_name: "Project Two",
        gross_cost: "2.5",
        credits: "-0.5",
        net_cost: "2",
      }),
    ],
  });

  assert.deepEqual(result.summary, { grossCost: 7, credits: -1.5, netCost: 5.5 });
  assert.equal(result.projects.length, 2);
});

test("keeps available billing accounts readable while a new FOCUS table propagates", () => {
  const rows = availableCloudCostSourceResults([
    { status: "fulfilled", value: { account: "thenuttybill" } },
    { status: "rejected", reason: { code: 404 } },
  ]);

  assert.deepEqual(rows, [{ account: "thenuttybill" }]);
  assert.throws(
    () => availableCloudCostSourceResults([{ status: "rejected", reason: { code: 404 } }]),
    (error: unknown) => Boolean(error && typeof error === "object" && "code" in error && error.code === 404),
  );
  assert.throws(
    () =>
      availableCloudCostSourceResults([
        { status: "fulfilled", value: { account: "thenuttybill" } },
        { status: "rejected", reason: { response: { status: 403 } } },
      ]),
    (error: unknown) =>
      Boolean(
        error &&
          typeof error === "object" &&
          "response" in error &&
          (error.response as { status?: number }).status === 403,
      ),
  );
});
