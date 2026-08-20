import "server-only";
import { google, type bigquery_v2 } from "googleapis";
import {
  buildCloudCostsQuery,
  cloudCostsConfiguration,
  CloudCostsConfigurationError,
  normalizeCloudCostRows,
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
    parameterType: { type: name === "cloudProjectId" ? "STRING" : "TIMESTAMP" },
    parameterValue: { value },
  }));
}

function rowsFromResponse(response: bigquery_v2.Schema$GetQueryResultsResponse): CloudCostRow[] {
  const fields = response.schema?.fields ?? [];
  return (response.rows ?? []).map((row) => {
    const values = Object.fromEntries(
      fields.map((field, index) => [field.name ?? String(index), row.f?.[index]?.v ?? null])
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

export async function loadCloudCosts(days: CloudCostPeriod): Promise<CloudCostsReport> {
  try {
    const configuration = cloudCostsConfiguration();
    const request = buildCloudCostsQuery({
      sourceTable: configuration.sourceTable,
      cloudProjectId: configuration.exportProjectId,
      days,
    });
    const auth = new google.auth.GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/bigquery"],
    });
    const bigquery = google.bigquery({ version: "v2", auth });
    const initial = await bigquery.jobs.query({
      projectId: configuration.queryProjectId,
      requestBody: {
        query: request.query,
        useLegacySql: false,
        parameterMode: "NAMED",
        queryParameters: queryParameters(request.parameters),
        location: "EU",
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
        projectId: configuration.queryProjectId,
        jobId,
        location: response.jobReference?.location ?? "EU",
        maxResults: 10_000,
        timeoutMs: 15_000,
      });
      response = completed.data;
      if (!response.jobComplete) throw new Error("BigQuery query timed out");
    }

    return normalizeCloudCostRows({
      days,
      from: request.parameters.from,
      to: request.parameters.to,
      rows: rowsFromResponse(response),
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
