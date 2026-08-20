export const CLOUD_COST_PERIODS = [7, 30, 90] as const;

export type CloudCostPeriod = (typeof CLOUD_COST_PERIODS)[number];

export type CloudCostRow = {
  usage_date: string;
  service_id: string;
  service_name: string;
  gross_cost: string | number | null;
  credits: string | number | null;
  net_cost: string | number | null;
  currency: string;
  latest_usage_at: string | null;
};

export type CloudCostService = {
  id: string;
  name: string;
  grossCost: number;
  credits: number;
  netCost: number;
};

export type CloudCostDay = {
  date: string;
  grossCost: number;
  credits: number;
  netCost: number;
};

export type CloudCostsReport = {
  period: { days: CloudCostPeriod; from: string; to: string };
  currency: string;
  summary: { grossCost: number; credits: number; netCost: number };
  services: CloudCostService[];
  daily: CloudCostDay[];
  latestUsageAt: string | null;
};

type CloudCostsConfigurationCode =
  | "BILLING_EXPORT_NOT_CONFIGURED"
  | "INVALID_CONFIGURATION";

export class CloudCostsConfigurationError extends Error {
  constructor(public readonly code: CloudCostsConfigurationCode) {
    super(code);
    this.name = "CloudCostsConfigurationError";
  }
}

const SAFE_PROJECT_ID = /^[a-z][a-z0-9-]{4,61}[a-z0-9]$/;
const SAFE_BIGQUERY_ID = /^[A-Za-z0-9_]+$/;

export function cloudCostsConfiguration() {
  const exportProjectId = process.env.GCP_BILLING_EXPORT_PROJECT_ID?.trim();
  const datasetId = process.env.GCP_BILLING_EXPORT_DATASET_ID?.trim();
  const tableId = process.env.GCP_BILLING_EXPORT_TABLE_ID?.trim();
  const queryProjectId =
    process.env.GCP_BILLING_QUERY_PROJECT_ID?.trim() || exportProjectId;

  if (!exportProjectId || !datasetId || !tableId || !queryProjectId) {
    throw new CloudCostsConfigurationError("BILLING_EXPORT_NOT_CONFIGURED");
  }

  if (
    !SAFE_PROJECT_ID.test(exportProjectId) ||
    !SAFE_PROJECT_ID.test(queryProjectId) ||
    !SAFE_BIGQUERY_ID.test(datasetId) ||
    !SAFE_BIGQUERY_ID.test(tableId)
  ) {
    throw new CloudCostsConfigurationError("INVALID_CONFIGURATION");
  }

  return {
    exportProjectId,
    datasetId,
    tableId,
    queryProjectId,
    sourceTable: `${exportProjectId}.${datasetId}.${tableId}`,
  };
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

export function buildCloudCostsQuery({
  sourceTable,
  cloudProjectId,
  days,
  now = new Date(),
}: {
  sourceTable: string;
  cloudProjectId: string;
  days: CloudCostPeriod;
  now?: Date;
}) {
  const to = startOfUtcDay(now);
  to.setUTCDate(to.getUTCDate() + 1);
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - days);

  return {
    query: `
      SELECT
        FORMAT_DATE('%F', DATE(usage_start_time, 'Europe/Amsterdam')) AS usage_date,
        service.id AS service_id,
        service.description AS service_name,
        SUM(CAST(cost AS NUMERIC)) AS gross_cost,
        SUM(IFNULL((SELECT SUM(CAST(credit.amount AS NUMERIC)) FROM UNNEST(credits) AS credit), 0)) AS credits,
        SUM(CAST(cost AS NUMERIC))
          + SUM(IFNULL((SELECT SUM(CAST(credit.amount AS NUMERIC)) FROM UNNEST(credits) AS credit), 0)) AS net_cost,
        ANY_VALUE(currency) AS currency,
        MAX(usage_start_time) AS latest_usage_at
      FROM \`${sourceTable}\`
      WHERE project.id = @cloudProjectId
        AND usage_start_time >= @from
        AND usage_start_time < @to
      GROUP BY usage_date, service_id, service_name
      ORDER BY usage_date ASC, net_cost DESC
    `,
    parameters: {
      cloudProjectId,
      from: from.toISOString(),
      to: to.toISOString(),
    },
  };
}

function numeric(value: string | number | null): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function rounded(value: number): number {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
}

export function normalizeCloudCostRows({
  rows,
  days,
  from,
  to,
}: {
  rows: CloudCostRow[];
  days: CloudCostPeriod;
  from: string;
  to: string;
}): CloudCostsReport {
  const services = new Map<string, CloudCostService>();
  const daily = new Map<string, CloudCostDay>();
  let latestUsageAt: string | null = null;
  let currency = rows.find((row) => row.currency)?.currency ?? "EUR";

  for (const row of rows) {
    const grossCost = numeric(row.gross_cost);
    const credits = numeric(row.credits);
    const netCost = numeric(row.net_cost);
    currency = row.currency || currency;

    const service = services.get(row.service_id) ?? {
      id: row.service_id,
      name: row.service_name,
      grossCost: 0,
      credits: 0,
      netCost: 0,
    };
    service.grossCost += grossCost;
    service.credits += credits;
    service.netCost += netCost;
    services.set(row.service_id, service);

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

    if (row.latest_usage_at) {
      const normalized = new Date(row.latest_usage_at).toISOString();
      if (!latestUsageAt || normalized > latestUsageAt) latestUsageAt = normalized;
    }
  }

  const fromDate = new Date(from);
  const completeDaily: CloudCostDay[] = [];
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

  const serviceList = [...services.values()]
    .map((service) => ({
      ...service,
      grossCost: rounded(service.grossCost),
      credits: rounded(service.credits),
      netCost: rounded(service.netCost),
    }))
    .sort((left, right) => right.netCost - left.netCost || left.name.localeCompare(right.name));

  const summary = serviceList.reduce(
    (total, service) => ({
      grossCost: total.grossCost + service.grossCost,
      credits: total.credits + service.credits,
      netCost: total.netCost + service.netCost,
    }),
    { grossCost: 0, credits: 0, netCost: 0 }
  );

  return {
    period: { days, from, to },
    currency,
    summary: {
      grossCost: rounded(summary.grossCost),
      credits: rounded(summary.credits),
      netCost: rounded(summary.netCost),
    },
    services: serviceList,
    daily: completeDaily,
    latestUsageAt,
  };
}
