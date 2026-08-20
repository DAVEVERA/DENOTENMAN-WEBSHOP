export const CLOUD_COST_PERIODS = [7, 30, 90] as const;

export type CloudCostPeriod = (typeof CLOUD_COST_PERIODS)[number];
export type CloudBillingExportFormat = "FOCUS" | "STANDARD";
export type CloudBillingAccountCostStatus = "AVAILABLE" | "NO_EXPORT";
export type CloudBillingAccountDiscovery = "LIVE" | "CONFIGURED" | "EXPORT_ONLY";

export type CloudBillingAccountMetadata = {
  id: string;
  displayName: string;
  open: boolean;
};

export type CloudBillingExportSource = {
  billingAccountId: string;
  projectId: string;
  datasetId: string;
  tableId: string;
  queryProjectId: string;
  format: CloudBillingExportFormat;
  location: string;
  sourceTable: string;
};

export type CloudCostRow = {
  coverage_only: string | boolean | null;
  billing_account_id: string;
  usage_date: string | null;
  project_id: string | null;
  project_name: string | null;
  service_id: string | null;
  service_name: string | null;
  gross_cost: string | number | null;
  credits: string | number | null;
  net_cost: string | number | null;
  currency: string;
  latest_usage_at: string | null;
  export_first_usage_at: string | null;
  export_latest_usage_at: string | null;
};

export type CloudCostService = {
  id: string;
  name: string;
  grossCost: number;
  credits: number;
  netCost: number;
};

export type CloudCostProject = CloudCostService & {
  billingAccountId: string;
};

export type CloudCostDay = {
  date: string;
  grossCost: number;
  credits: number;
  netCost: number;
};

export type CloudBillingAccountCost = {
  id: string;
  displayName: string;
  open: boolean;
  costStatus: CloudBillingAccountCostStatus;
  currency: string;
  grossCost: number | null;
  credits: number | null;
  netCost: number | null;
  projectCount: number;
  latestUsageAt: string | null;
  exportFirstUsageAt: string | null;
  exportLatestUsageAt: string | null;
};

export type CloudCostsReport = {
  period: { days: CloudCostPeriod; from: string; to: string };
  currency: string;
  summary: { grossCost: number; credits: number; netCost: number };
  coverage: { totalAccounts: number; accountsWithExport: number; accountsWithoutExport: number };
  accountDiscovery: CloudBillingAccountDiscovery;
  accounts: CloudBillingAccountCost[];
  projects: CloudCostProject[];
  services: CloudCostService[];
  daily: CloudCostDay[];
  latestUsageAt: string | null;
};

type CloudCostsConfigurationCode =
  | "BILLING_EXPORT_NOT_CONFIGURED"
  | "INVALID_CONFIGURATION";

export class CloudCostsConfigurationError extends Error {
  constructor(public readonly code: CloudCostsConfigurationCode, options?: ErrorOptions) {
    super(code, options);
    this.name = "CloudCostsConfigurationError";
  }
}

const SAFE_PROJECT_ID = /^[a-z][a-z0-9-]{4,61}[a-z0-9]$/;
const SAFE_BIGQUERY_ID = /^[A-Za-z0-9_]+$/;
const SAFE_LOCATION = /^[A-Za-z0-9-]+$/;
const SAFE_BILLING_ACCOUNT_ID = /^[0-9A-F]{6}-[0-9A-F]{6}-[0-9A-F]{6}$/;

function inferBillingAccountId(tableId: string): string | null {
  const match = tableId.toUpperCase().match(/([0-9A-F]{6})_([0-9A-F]{6})_([0-9A-F]{6})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function sourceFromUnknown(value: unknown): CloudBillingExportSource {
  if (!value || typeof value !== "object") {
    throw new CloudCostsConfigurationError("INVALID_CONFIGURATION");
  }
  const candidate = value as Record<string, unknown>;
  const projectId = typeof candidate.projectId === "string" ? candidate.projectId.trim() : "";
  const datasetId = typeof candidate.datasetId === "string" ? candidate.datasetId.trim() : "";
  const tableId = typeof candidate.tableId === "string" ? candidate.tableId.trim() : "";
  const queryProjectId =
    typeof candidate.queryProjectId === "string" && candidate.queryProjectId.trim()
      ? candidate.queryProjectId.trim()
      : projectId;
  const billingAccountId =
    typeof candidate.billingAccountId === "string" && candidate.billingAccountId.trim()
      ? candidate.billingAccountId.trim().toUpperCase()
      : inferBillingAccountId(tableId) ?? "";
  const inferredFormat = tableId.toLowerCase().includes("_focus_") ? "FOCUS" : "STANDARD";
  const format =
    candidate.format === "FOCUS" || candidate.format === "STANDARD"
      ? candidate.format
      : inferredFormat;
  const location =
    typeof candidate.location === "string" && candidate.location.trim()
      ? candidate.location.trim()
      : "EU";

  if (
    !SAFE_PROJECT_ID.test(projectId) ||
    !SAFE_PROJECT_ID.test(queryProjectId) ||
    !SAFE_BIGQUERY_ID.test(datasetId) ||
    !SAFE_BIGQUERY_ID.test(tableId) ||
    !SAFE_LOCATION.test(location) ||
    !SAFE_BILLING_ACCOUNT_ID.test(billingAccountId)
  ) {
    throw new CloudCostsConfigurationError("INVALID_CONFIGURATION");
  }

  return {
    billingAccountId,
    projectId,
    datasetId,
    tableId,
    queryProjectId,
    format,
    location,
    sourceTable: `${projectId}.${datasetId}.${tableId}`,
  };
}

export function parseBillingAccountCatalog(value = process.env.GCP_BILLING_ACCOUNTS_JSON) {
  if (!value?.trim()) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed) || parsed.length > 100) throw new Error("invalid catalog");
    const accounts = parsed.map((item) => {
      if (!item || typeof item !== "object") throw new Error("invalid account");
      const candidate = item as Record<string, unknown>;
      const id = typeof candidate.id === "string" ? candidate.id.trim().toUpperCase() : "";
      const displayName =
        typeof candidate.displayName === "string" ? candidate.displayName.trim() : "";
      if (!SAFE_BILLING_ACCOUNT_ID.test(id) || !displayName || displayName.length > 200) {
        throw new Error("invalid account");
      }
      return { id, displayName, open: candidate.open === true };
    });
    if (new Set(accounts.map((account) => account.id)).size !== accounts.length) {
      throw new Error("duplicate account");
    }
    return accounts;
  } catch (error) {
    throw new CloudCostsConfigurationError("INVALID_CONFIGURATION", { cause: error });
  }
}

export function cloudCostsConfiguration() {
  const configuredSources = process.env.GCP_BILLING_EXPORT_SOURCES_JSON?.trim();
  let sources: CloudBillingExportSource[];

  if (configuredSources) {
    try {
      const parsed = JSON.parse(configuredSources) as unknown;
      if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > 20) {
        throw new Error("invalid sources");
      }
      sources = parsed.map(sourceFromUnknown);
    } catch (error) {
      if (error instanceof CloudCostsConfigurationError) throw error;
      throw new CloudCostsConfigurationError("INVALID_CONFIGURATION", { cause: error });
    }
  } else {
    const projectId = process.env.GCP_BILLING_EXPORT_PROJECT_ID?.trim();
    const datasetId = process.env.GCP_BILLING_EXPORT_DATASET_ID?.trim();
    const tableId = process.env.GCP_BILLING_EXPORT_TABLE_ID?.trim();
    if (!projectId || !datasetId || !tableId) {
      throw new CloudCostsConfigurationError("BILLING_EXPORT_NOT_CONFIGURED");
    }
    sources = [
      sourceFromUnknown({
        billingAccountId: process.env.GCP_BILLING_ACCOUNT_ID,
        projectId,
        datasetId,
        tableId,
        queryProjectId: process.env.GCP_BILLING_QUERY_PROJECT_ID,
        format: process.env.GCP_BILLING_EXPORT_FORMAT,
        location: process.env.GCP_BILLING_EXPORT_LOCATION,
      }),
    ];
  }

  if (new Set(sources.map((source) => source.billingAccountId)).size !== sources.length) {
    throw new CloudCostsConfigurationError("INVALID_CONFIGURATION");
  }

  return { sources, accountCatalog: parseBillingAccountCatalog() };
}

export function parseCloudCostDays(value: string | null): CloudCostPeriod {
  const parsed = Number(value);
  return CLOUD_COST_PERIODS.includes(parsed as CloudCostPeriod)
    ? (parsed as CloudCostPeriod)
    : 30;
}

function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function queryWindow(days: CloudCostPeriod, now: Date) {
  const to = startOfUtcDay(now);
  to.setUTCDate(to.getUTCDate() + 1);
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - days);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function buildCloudCostsQuery({
  source,
  days,
  now = new Date(),
}: {
  source: CloudBillingExportSource;
  days: CloudCostPeriod;
  now?: Date;
}) {
  const parameters = {
    billingAccountId: source.billingAccountId,
    ...queryWindow(days, now),
  };
  const fields =
    source.format === "FOCUS"
      ? {
          account: "BillingAccountId",
          timestamp: "ChargePeriodStart",
          projectId: "SubAccountId",
          projectName: "SubAccountName",
          serviceId: "x_ServiceId",
          serviceName: "ServiceName",
          gross: "ListCost",
          net: "BilledCost",
          currency: "BillingCurrency",
        }
      : {
          account: "billing_account_id",
          timestamp: "usage_start_time",
          projectId: "project.id",
          projectName: "project.name",
          serviceId: "service.id",
          serviceName: "service.description",
          gross: "cost",
          net: "cost + IFNULL((SELECT SUM(credit.amount) FROM UNNEST(credits) AS credit), 0)",
          currency: "currency",
        };

  return {
    query: `
      WITH coverage AS (
        SELECT
          ${fields.account} AS billing_account_id,
          ANY_VALUE(${fields.currency}) AS currency,
          MIN(${fields.timestamp}) AS export_first_usage_at,
          MAX(${fields.timestamp}) AS export_latest_usage_at
        FROM \`${source.sourceTable}\`
        WHERE ${fields.account} = @billingAccountId
        GROUP BY billing_account_id
      ), period_costs AS (
        SELECT
          ${fields.account} AS billing_account_id,
          FORMAT_DATE('%F', DATE(${fields.timestamp}, 'Europe/Amsterdam')) AS usage_date,
          COALESCE(${fields.projectId}, 'unassigned') AS project_id,
          COALESCE(${fields.projectName}, 'Niet aan een project toegewezen') AS project_name,
          COALESCE(${fields.serviceId}, ${fields.serviceName}, 'unknown') AS service_id,
          COALESCE(${fields.serviceName}, 'Onbekende dienst') AS service_name,
          SUM(CAST(${fields.gross} AS NUMERIC)) AS gross_cost,
          SUM(CAST((${fields.net}) - (${fields.gross}) AS NUMERIC)) AS credits,
          SUM(CAST(${fields.net} AS NUMERIC)) AS net_cost,
          ANY_VALUE(${fields.currency}) AS currency,
          MAX(${fields.timestamp}) AS latest_usage_at
        FROM \`${source.sourceTable}\`
        WHERE ${fields.account} = @billingAccountId
          AND ${fields.timestamp} >= @from
          AND ${fields.timestamp} < @to
        GROUP BY billing_account_id, usage_date, project_id, project_name, service_id, service_name
      )
      SELECT
        FALSE AS coverage_only,
        costs.*,
        coverage.export_first_usage_at,
        coverage.export_latest_usage_at
      FROM period_costs AS costs
      JOIN coverage USING (billing_account_id)
      UNION ALL
      SELECT
        TRUE AS coverage_only,
        coverage.billing_account_id,
        NULL AS usage_date,
        NULL AS project_id,
        NULL AS project_name,
        NULL AS service_id,
        NULL AS service_name,
        0 AS gross_cost,
        0 AS credits,
        0 AS net_cost,
        coverage.currency,
        NULL AS latest_usage_at,
        coverage.export_first_usage_at,
        coverage.export_latest_usage_at
      FROM coverage
      ORDER BY usage_date ASC, net_cost DESC
    `,
    parameters,
  };
}

function numeric(value: string | number | null): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function rounded(value: number): number {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
}

function isCoverageRow(row: CloudCostRow) {
  return row.coverage_only === true || row.coverage_only === "true" || row.usage_date === null;
}

function latest(current: string | null, candidate: string | null) {
  if (!candidate) return current;
  const normalized = new Date(candidate).toISOString();
  return !current || normalized > current ? normalized : current;
}

export function normalizeCloudCostRows({
  rows,
  accounts: accountMetadata,
  accountDiscovery,
  days,
  from,
  to,
}: {
  rows: CloudCostRow[];
  accounts: CloudBillingAccountMetadata[];
  accountDiscovery: CloudBillingAccountDiscovery;
  days: CloudCostPeriod;
  from: string;
  to: string;
}): CloudCostsReport {
  const services = new Map<string, CloudCostService>();
  const projects = new Map<string, CloudCostProject>();
  const daily = new Map<string, CloudCostDay>();
  const accountCosts = new Map<string, Omit<CloudBillingAccountCost, "displayName" | "open" | "costStatus">>();
  const coveredAccounts = new Set<string>();
  let latestUsageAt: string | null = null;

  for (const row of rows) {
    coveredAccounts.add(row.billing_account_id);
    const account = accountCosts.get(row.billing_account_id) ?? {
      id: row.billing_account_id,
      currency: row.currency || "EUR",
      grossCost: 0,
      credits: 0,
      netCost: 0,
      projectCount: 0,
      latestUsageAt: null,
      exportFirstUsageAt: row.export_first_usage_at
        ? new Date(row.export_first_usage_at).toISOString()
        : null,
      exportLatestUsageAt: row.export_latest_usage_at
        ? new Date(row.export_latest_usage_at).toISOString()
        : null,
    };
    account.exportFirstUsageAt = row.export_first_usage_at
      ? new Date(row.export_first_usage_at).toISOString()
      : account.exportFirstUsageAt;
    account.exportLatestUsageAt = latest(account.exportLatestUsageAt, row.export_latest_usage_at);
    accountCosts.set(row.billing_account_id, account);

    if (isCoverageRow(row)) continue;
    const grossCost = numeric(row.gross_cost);
    const credits = numeric(row.credits);
    const netCost = numeric(row.net_cost);
    account.grossCost = numeric(account.grossCost) + grossCost;
    account.credits = numeric(account.credits) + credits;
    account.netCost = numeric(account.netCost) + netCost;
    account.latestUsageAt = latest(account.latestUsageAt, row.latest_usage_at);
    latestUsageAt = latest(latestUsageAt, row.latest_usage_at);

    const serviceId = row.service_id ?? "unknown";
    const service = services.get(serviceId) ?? {
      id: serviceId,
      name: row.service_name ?? "Onbekende dienst",
      grossCost: 0,
      credits: 0,
      netCost: 0,
    };
    service.grossCost += grossCost;
    service.credits += credits;
    service.netCost += netCost;
    services.set(serviceId, service);

    const projectId = row.project_id ?? "unassigned";
    const projectKey = `${row.billing_account_id}:${projectId}`;
    const project = projects.get(projectKey) ?? {
      id: projectId,
      name: row.project_name ?? projectId,
      billingAccountId: row.billing_account_id,
      grossCost: 0,
      credits: 0,
      netCost: 0,
    };
    project.grossCost += grossCost;
    project.credits += credits;
    project.netCost += netCost;
    projects.set(projectKey, project);

    if (row.usage_date) {
      const day = daily.get(row.usage_date) ?? {
        date: row.usage_date,
        grossCost: 0,
        credits: 0,
        netCost: 0,
      };
      day.grossCost += grossCost;
      day.credits += credits;
      day.netCost += netCost;
      daily.set(row.usage_date, day);
    }
  }

  for (const account of accountCosts.values()) {
    account.projectCount = [...projects.values()].filter(
      (project) => project.billingAccountId === account.id
    ).length;
  }

  const metadata = new Map(accountMetadata.map((account) => [account.id, account]));
  for (const accountId of coveredAccounts) {
    if (!metadata.has(accountId)) {
      metadata.set(accountId, { id: accountId, displayName: accountId, open: true });
    }
  }

  const accounts: CloudBillingAccountCost[] = [...metadata.values()]
    .map((item) => {
      const cost = accountCosts.get(item.id);
      return cost
        ? {
            ...cost,
            displayName: item.displayName,
            open: item.open,
            costStatus: "AVAILABLE" as const,
            grossCost: rounded(numeric(cost.grossCost)),
            credits: rounded(numeric(cost.credits)),
            netCost: rounded(numeric(cost.netCost)),
          }
        : {
            id: item.id,
            displayName: item.displayName,
            open: item.open,
            costStatus: "NO_EXPORT" as const,
            currency: "EUR",
            grossCost: null,
            credits: null,
            netCost: null,
            projectCount: 0,
            latestUsageAt: null,
            exportFirstUsageAt: null,
            exportLatestUsageAt: null,
          };
    })
    .sort((left, right) => Number(right.open) - Number(left.open) || left.displayName.localeCompare(right.displayName));

  const completeDaily: CloudCostDay[] = [];
  const fromDate = new Date(from);
  for (let index = 0; index < days; index += 1) {
    const date = new Date(fromDate);
    date.setUTCDate(date.getUTCDate() + index);
    const key = date.toISOString().slice(0, 10);
    const item = daily.get(key) ?? { date: key, grossCost: 0, credits: 0, netCost: 0 };
    completeDaily.push({
      ...item,
      grossCost: rounded(item.grossCost),
      credits: rounded(item.credits),
      netCost: rounded(item.netCost),
    });
  }

  const roundedServices = [...services.values()]
    .map((service) => ({
      ...service,
      grossCost: rounded(service.grossCost),
      credits: rounded(service.credits),
      netCost: rounded(service.netCost),
    }))
    .sort((left, right) => right.netCost - left.netCost || left.name.localeCompare(right.name));
  const roundedProjects = [...projects.values()]
    .map((project) => ({
      ...project,
      grossCost: rounded(project.grossCost),
      credits: rounded(project.credits),
      netCost: rounded(project.netCost),
    }))
    .sort((left, right) => right.netCost - left.netCost || left.name.localeCompare(right.name));
  const summary = accounts.reduce(
    (total, account) => ({
      grossCost: total.grossCost + numeric(account.grossCost),
      credits: total.credits + numeric(account.credits),
      netCost: total.netCost + numeric(account.netCost),
    }),
    { grossCost: 0, credits: 0, netCost: 0 }
  );
  const accountsWithExport = accounts.filter((account) => account.costStatus === "AVAILABLE").length;
  const currency = accounts.find((account) => account.costStatus === "AVAILABLE")?.currency ?? "EUR";

  return {
    period: { days, from, to },
    currency,
    summary: {
      grossCost: rounded(summary.grossCost),
      credits: rounded(summary.credits),
      netCost: rounded(summary.netCost),
    },
    coverage: {
      totalAccounts: accounts.length,
      accountsWithExport,
      accountsWithoutExport: accounts.length - accountsWithExport,
    },
    accountDiscovery,
    accounts,
    projects: roundedProjects,
    services: roundedServices,
    daily: completeDaily,
    latestUsageAt,
  };
}
