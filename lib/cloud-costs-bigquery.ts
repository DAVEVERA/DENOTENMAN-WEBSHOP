import "server-only";
import { google, type bigquery_v2 } from "googleapis";
import {
  buildCloudCostsQuery,
  cloudCostsConfiguration,
  CloudCostsConfigurationError,
  normalizeCloudCostRows,
  type CloudBillingAccountDiscovery,
  type CloudBillingAccountMetadata,
  type CloudBillingExportSource,
  type CloudCostPeriod,
  type CloudCostRow,
  type CloudCostsReport,
} from "@/lib/cloud-costs";

export type CloudCostsProviderErrorCode =
  | "BILLING_EXPORT_NOT_CONFIGURED"
  | "BILLING_EXPORT_FORBIDDEN"
  | "BILLING_EXPORT_UNAVAILABLE"
  | "INVALID_CONFIGURATION";

export class CloudCostsProviderError extends Error {
  constructor(public readonly code: CloudCostsProviderErrorCode, options?: ErrorOptions) {
    super(code, options);
    this.name = "CloudCostsProviderError";
  }
}

function queryParameters(parameters: Record<string, string>): bigquery_v2.Schema$QueryParameter[] {
  return Object.entries(parameters).map(([name, value]) => ({
    name,
    parameterType: { type: name === "billingAccountId" ? "STRING" : "TIMESTAMP" },
    parameterValue: { value },
  }));
}

function rowsFromResponse(response: bigquery_v2.Schema$GetQueryResultsResponse): CloudCostRow[] {
  const fields = response.schema?.fields ?? [];
  return (response.rows ?? []).map((row) => {
    const values = Object.fromEntries(
      fields.map((field, index) => {
        const raw = row.f?.[index]?.v ?? null;
        const numericTimestamp = field.type === "TIMESTAMP" ? Number(raw) : Number.NaN;
        const value =
          raw !== null && Number.isFinite(numericTimestamp)
            ? new Date(numericTimestamp * 1_000).toISOString()
            : raw;
        return [field.name ?? String(index), value];
      })
    );
    return values as CloudCostRow;
  });
}

function errorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const candidate = error as { code?: unknown; response?: { status?: unknown } };
  if (typeof candidate.code === "number") return candidate.code;
  return typeof candidate.response?.status === "number" ? candidate.response.status : undefined;
}

async function runSourceQuery({
  bigquery,
  source,
  days,
}: {
  bigquery: bigquery_v2.Bigquery;
  source: CloudBillingExportSource;
  days: CloudCostPeriod;
}) {
  const request = buildCloudCostsQuery({ source, days });
  const initial = await bigquery.jobs.query({
    projectId: source.queryProjectId,
    requestBody: {
      query: request.query,
      useLegacySql: false,
      parameterMode: "NAMED",
      queryParameters: queryParameters(request.parameters),
      location: source.location,
      maxResults: 10_000,
      maximumBytesBilled: process.env.GCP_BILLING_MAX_BYTES_BILLED || "1000000000",
      timeoutMs: 15_000,
      labels: { workload: "admin_cloud_costs" },
    },
  });

  let response: bigquery_v2.Schema$GetQueryResultsResponse = initial.data;
  if (!response.jobComplete) {
    const jobId = response.jobReference?.jobId;
    if (!jobId) throw new Error("BigQuery did not return a job ID");
    const completed = await bigquery.jobs.getQueryResults({
      projectId: source.queryProjectId,
      jobId,
      location: response.jobReference?.location ?? source.location,
      maxResults: 10_000,
      timeoutMs: 15_000,
    });
    response = completed.data;
    if (!response.jobComplete) throw new Error("BigQuery query timed out");
  }

  const rows = rowsFromResponse(response);
  const jobId = response.jobReference?.jobId;
  let pageToken = response.pageToken ?? undefined;
  while (pageToken) {
    if (!jobId) throw new Error("BigQuery did not return a job ID for pagination");
    const next = await bigquery.jobs.getQueryResults({
      projectId: source.queryProjectId,
      jobId,
      location: response.jobReference?.location ?? source.location,
      maxResults: 10_000,
      pageToken,
      timeoutMs: 15_000,
    });
    rows.push(...rowsFromResponse(next.data));
    pageToken = next.data.pageToken ?? undefined;
  }

  return { rows, from: request.parameters.from, to: request.parameters.to };
}

function mergeAccounts(
  primary: CloudBillingAccountMetadata[],
  fallback: CloudBillingAccountMetadata[]
) {
  const accounts = new Map(fallback.map((account) => [account.id, account]));
  for (const account of primary) accounts.set(account.id, account);
  return [...accounts.values()];
}

async function discoverBillingAccounts({
  auth,
  configured,
}: {
  auth: InstanceType<typeof google.auth.GoogleAuth>;
  configured: CloudBillingAccountMetadata[];
}): Promise<{ accounts: CloudBillingAccountMetadata[]; discovery: CloudBillingAccountDiscovery }> {
  try {
    const cloudBilling = google.cloudbilling({ version: "v1", auth });
    const accounts: CloudBillingAccountMetadata[] = [];
    let pageToken: string | undefined;
    do {
      const response = await cloudBilling.billingAccounts.list({ pageSize: 100, pageToken });
      for (const account of response.data.billingAccounts ?? []) {
        const id = account.name?.replace(/^billingAccounts\//, "").toUpperCase();
        if (!id || !account.displayName) continue;
        accounts.push({ id, displayName: account.displayName, open: account.open === true });
      }
      pageToken = response.data.nextPageToken ?? undefined;
    } while (pageToken);
    return { accounts: mergeAccounts(accounts, configured), discovery: "LIVE" };
  } catch {
    return configured.length
      ? { accounts: configured, discovery: "CONFIGURED" }
      : { accounts: [], discovery: "EXPORT_ONLY" };
  }
}

export async function loadCloudCosts(days: CloudCostPeriod): Promise<CloudCostsReport> {
  try {
    const configuration = cloudCostsConfiguration();
    const auth = new google.auth.GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });
    const bigquery = google.bigquery({ version: "v2", auth });
    const [queryResults, accountResult] = await Promise.all([
      Promise.all(
        configuration.sources.map((source) => runSourceQuery({ bigquery, source, days }))
      ),
      discoverBillingAccounts({ auth, configured: configuration.accountCatalog }),
    ]);
    const first = queryResults[0];
    return normalizeCloudCostRows({
      days,
      from: first.from,
      to: first.to,
      rows: queryResults.flatMap((result) => result.rows),
      accounts: accountResult.accounts,
      accountDiscovery: accountResult.discovery,
    });
  } catch (error) {
    if (error instanceof CloudCostsConfigurationError) {
      throw new CloudCostsProviderError(error.code, { cause: error });
    }
    const status = errorStatus(error);
    if (status === 403) {
      throw new CloudCostsProviderError("BILLING_EXPORT_FORBIDDEN", { cause: error });
    }
    throw new CloudCostsProviderError("BILLING_EXPORT_UNAVAILABLE", { cause: error });
  }
}
