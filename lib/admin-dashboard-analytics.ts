import "server-only";

import { google } from "googleapis";
import { z } from "zod";
import type {
  DashboardAnalytics,
  DashboardTrendPoint,
} from "@/lib/admin-dashboard-contract";
import { EMPTY_DASHBOARD_ANALYTICS } from "@/lib/admin-dashboard-contract";
import { buildDashboardForecast, buildDashboardFunnel, buildDashboardIssues } from "@/lib/admin-dashboard-analysis";
import { getSetting, setSetting } from "@/lib/settings";

const PROPERTY_ID = process.env.GA4_PROPERTY_ID?.trim() ?? "";
const ANALYTICS_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const REQUEST_TIMEOUT_MS = 8_000;
const CACHE_TTL_MS = 60_000;
const TRANSIENT_RETRY_DELAY_MS = 250;
const GA4_SNAPSHOT_SETTING_KEY = "analytics.ga4.dashboard.snapshot.v1";
const GA4_SNAPSHOT_VERSION = 1;

const nullableMetricSchema = z.number().finite().nullable();
const dashboardAnalyticsSchema = z.object({
  status: z.enum(["live", "partial", "unavailable"]),
  generatedAt: z.string().datetime(),
  propertyId: z.string(),
  message: z.string(),
  metrics: z.object({
    activeVisitors: nullableMetricSchema,
    revenueToday: nullableMetricSchema,
    sessions: nullableMetricSchema,
    views: nullableMetricSchema,
    engagement: nullableMetricSchema,
    keyEvents: nullableMetricSchema,
  }),
  daily: z.array(z.object({
    date: z.string(),
    sessions: z.number().finite(),
    revenue: z.number().finite(),
    partial: z.boolean().optional(),
  })).max(100),
  forecast: z.object({
    confidence: z.enum(["onvoldoende", "laag", "middel", "hoog"]),
    trainingDays: z.number().int().nonnegative(),
    reason: z.string(),
    points: z.array(z.object({
      date: z.string(),
      expected: z.number().finite(),
      low: z.number().finite(),
      high: z.number().finite(),
    })).max(14),
  }),
  funnel: z.object({
    cart: nullableMetricSchema,
    checkout: nullableMetricSchema,
    purchase: nullableMetricSchema,
  }),
  signals: z.object({
    critical: z.number().int().nonnegative(),
    high: z.number().int().nonnegative(),
    positive: z.number().int().nonnegative(),
  }),
  issues: z.array(z.object({
    id: z.string(),
    severity: z.enum(["critical", "high", "positive", "info"]),
    title: z.string(),
    evidence: z.string(),
    action: z.string(),
  })).max(100),
});

const persistedSnapshotSchema = z.object({
  version: z.literal(GA4_SNAPSHOT_VERSION),
  data: dashboardAnalyticsSchema,
});

type ReportRow = {
  dimensionValues?: Array<{ value?: string | null }>;
  metricValues?: Array<{ value?: string | null }>;
};

type Report = {
  dimensionHeaders?: Array<{ name?: string | null }>;
  metricHeaders?: Array<{ name?: string | null }>;
  rows?: ReportRow[];
};

type ParsedRow = Record<string, string | number>;

let analyticsCache:
  | { expiresAt: number; value: Promise<DashboardAnalytics> }
  | undefined;
let analyticsRefresh: Promise<DashboardAnalytics> | undefined;
let lastSuccessfulAnalytics: DashboardAnalytics | undefined;
let lastForcedRefreshAt = 0;

function snapshotMoment(generatedAt: string): string {
  const date = new Date(generatedAt);
  if (!Number.isFinite(date.getTime())) return "een eerder meetmoment";
  return new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Amsterdam",
  }).format(date);
}

function asPersistentFallback(data: DashboardAnalytics, reason: string): DashboardAnalytics {
  return {
    ...data,
    status: "partial",
    message: `${reason} Laatst geldige GA4-meting: ${snapshotMoment(data.generatedAt)}.`,
  };
}

async function loadPersistedAnalytics(): Promise<DashboardAnalytics | undefined> {
  try {
    const raw = await getSetting(GA4_SNAPSHOT_SETTING_KEY);
    if (!raw) return undefined;
    const parsed = persistedSnapshotSchema.safeParse(JSON.parse(raw));
    if (
      !parsed.success ||
      parsed.data.data.status === "unavailable" ||
      parsed.data.data.propertyId !== PROPERTY_ID
    ) {
      return undefined;
    }
    return parsed.data.data;
  } catch (error) {
    console.error("Admin dashboard GA4 snapshot read failed", {
      code: error instanceof Error ? error.message : "UNKNOWN",
    });
    return undefined;
  }
}

async function persistAnalytics(data: DashboardAnalytics): Promise<void> {
  try {
    await setSetting(
      GA4_SNAPSHOT_SETTING_KEY,
      JSON.stringify({ version: GA4_SNAPSHOT_VERSION, data })
    );
  } catch (error) {
    console.error("Admin dashboard GA4 snapshot write failed", {
      code: error instanceof Error ? error.message : "UNKNOWN",
    });
  }
}

function number(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isoDate(value: unknown): string {
  const raw = String(value ?? "");
  if (/^\d{8}$/.test(raw)) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }
  return raw.slice(0, 10);
}

function rowsFromReport(report: Report): ParsedRow[] {
  const dimensions = (report.dimensionHeaders ?? []).map((header) => header.name ?? "");
  const metrics = (report.metricHeaders ?? []).map((header) => header.name ?? "");

  return (report.rows ?? []).map((row) => {
    const result: ParsedRow = {};
    dimensions.forEach((name, index) => {
      result[name] = row.dimensionValues?.[index]?.value ?? "";
    });
    metrics.forEach((name, index) => {
      result[name] = number(row.metricValues?.[index]?.value);
    });
    return result;
  });
}

function reportBody(
  startDate: string,
  endDate: string,
  dimensions: string[],
  metrics: string[],
  limit = 100
) {
  return {
    dateRanges: [{ startDate, endDate }],
    dimensions: dimensions.map((name) => ({ name })),
    metrics: metrics.map((name) => ({ name })),
    limit: String(limit),
  };
}

async function withTimeout<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("GA4_TIMEOUT")), milliseconds);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function isRetryableGa4Error(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    code?: string | number;
    message?: string;
    response?: { status?: number };
  };
  const status = Number(candidate.response?.status ?? candidate.code);
  return (
    status === 408 ||
    status === 429 ||
    status >= 500 ||
    candidate.code === "ETIMEDOUT" ||
    candidate.code === "ECONNRESET" ||
    candidate.message === "GA4_TIMEOUT"
  );
}

async function requestWithRetry<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isRetryableGa4Error(error)) throw error;
    await new Promise((resolve) => setTimeout(resolve, TRANSIENT_RETRY_DELAY_MS));
    return operation();
  }
}

async function fetchFreshAnalytics(): Promise<DashboardAnalytics> {
  try {
    if (!/^\d+$/.test(PROPERTY_ID)) throw new Error("GA4_NOT_CONFIGURED");
    const auth = new google.auth.GoogleAuth({ scopes: [ANALYTICS_SCOPE] });
    const authClient = await withTimeout(auth.getClient(), REQUEST_TIMEOUT_MS);
    const client = authClient as unknown as {
      request<T>(options: {
        url: string;
        method: "POST";
        data: unknown;
        timeout: number;
      }): Promise<{ data: T }>;
    };
    const request = (method: "runReport" | "runRealtimeReport", data: unknown) =>
      requestWithRetry(() =>
        client.request<Report>({
          url: `https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY_ID}:${method}`,
          method: "POST",
          data,
          timeout: REQUEST_TIMEOUT_MS,
        })
      );

    const results = await Promise.allSettled([
      request("runRealtimeReport", { metrics: [{ name: "activeUsers" }] }),
      request(
        "runReport",
        reportBody("today", "today", [], [
          "sessions",
          "screenPageViews",
          "engagementRate",
          "keyEvents",
          "purchaseRevenue",
          "transactions",
        ], 1)
      ),
      request("runReport", reportBody("89daysAgo", "yesterday", ["date"], ["sessions", "purchaseRevenue"], 100)),
      request("runReport", reportBody("29daysAgo", "today", [], ["sessions", "screenPageViews", "engagementRate", "purchaseRevenue", "transactions"], 1)),
      request("runReport", reportBody("29daysAgo", "today", ["eventName"], ["eventCount"], 100)),
      request("runReport", reportBody("29daysAgo", "today", ["pageTitle"], ["screenPageViews"], 100)),
      request("runReport", reportBody("29daysAgo", "today", ["sessionSourceMedium"], ["sessions"], 100)),
      request("runReport", reportBody("29daysAgo", "today", ["sessionDefaultChannelGroup"], ["sessions"], 50)),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled").length;
    if (fulfilled === 0) throw new Error("GA4_ALL_REQUESTS_FAILED");
    const reportAt = (index: number): Report =>
      results[index]?.status === "fulfilled" ? results[index].value.data : {};
    const realtime = rowsFromReport(reportAt(0))[0];
    const today = rowsFromReport(reportAt(1))[0] ?? {};
    const daily = rowsFromReport(reportAt(2))
      .map((row): DashboardTrendPoint => ({
        date: isoDate(row.date),
        sessions: number(row.sessions),
        revenue: number(row.purchaseRevenue),
        partial: false,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
    const analysisSummary = rowsFromReport(reportAt(3))[0] ?? {};
    const events = rowsFromReport(reportAt(4));
    const pages = rowsFromReport(reportAt(5));
    const sources = rowsFromReport(reportAt(6));
    const channels = rowsFromReport(reportAt(7));
    const fullDays = daily.length;
    const diagnosticsAvailable = [3, 4, 5, 6, 7].every(
      (index) => results[index]?.status === "fulfilled"
    );
    const diagnostics = diagnosticsAvailable
      ? buildDashboardIssues({
          summary: analysisSummary,
          pages,
          sources,
          channels,
          events,
          coverageDays: fullDays,
        })
      : { issues: [], funnel: buildDashboardFunnel(events) };
    const { issues } = diagnostics;
    const status = fulfilled === results.length ? "live" : "partial";

    return {
      status,
      generatedAt: new Date().toISOString(),
      propertyId: PROPERTY_ID,
      message:
        status === "live"
          ? "Live GA4-gegevens"
          : "Een deel van de GA4-gegevens kon niet worden vernieuwd.",
      metrics: {
        activeVisitors: results[0]?.status === "fulfilled" ? number(realtime?.activeUsers) : null,
        revenueToday: results[1]?.status === "fulfilled" ? number(today.purchaseRevenue) : null,
        sessions: results[1]?.status === "fulfilled" ? number(today.sessions) : null,
        views: results[1]?.status === "fulfilled" ? number(today.screenPageViews) : null,
        engagement: results[1]?.status === "fulfilled" ? number(today.engagementRate) : null,
        keyEvents: results[1]?.status === "fulfilled" ? number(today.keyEvents) : null,
      },
      daily,
      forecast: buildDashboardForecast(daily),
      funnel:
        results[4]?.status === "fulfilled"
          ? buildDashboardFunnel(events)
          : { cart: null, checkout: null, purchase: null },
      signals: {
        critical: issues.filter((issue) => issue.severity === "critical").length,
        high: issues.filter((issue) => issue.severity === "high").length,
        positive: issues.filter((issue) => issue.severity === "positive").length,
      },
      issues,
    };
  } catch (error) {
    console.error("Admin dashboard GA4 refresh failed", {
      code: error instanceof Error ? error.message : "UNKNOWN",
    });
    return {
      ...EMPTY_DASHBOARD_ANALYTICS,
      generatedAt: new Date().toISOString(),
      propertyId: PROPERTY_ID,
    };
  }
}

export function getAdminDashboardAnalytics(options?: { force?: boolean }) {
  const now = Date.now();
  if (analyticsRefresh) return analyticsRefresh;
  const forceAllowed = options?.force && now - lastForcedRefreshAt >= 15_000;
  if (!forceAllowed && analyticsCache && analyticsCache.expiresAt > now) {
    return analyticsCache.value;
  }
  if (forceAllowed) lastForcedRefreshAt = now;
  const value = fetchFreshAnalytics().then(async (fresh) => {
    if (fresh.status !== "unavailable") {
      lastSuccessfulAnalytics = fresh;
      await persistAnalytics(fresh);
      return fresh;
    }
    const fallback = lastSuccessfulAnalytics ?? await loadPersistedAnalytics();
    if (fallback) {
      lastSuccessfulAnalytics = fallback;
      return asPersistentFallback(
        fallback,
        "Live vernieuwen is mislukt; de laatst opgeslagen gegevens worden getoond."
      );
    }
    return fresh;
  });
  analyticsRefresh = value.finally(() => {
    analyticsRefresh = undefined;
  });
  analyticsCache = { expiresAt: now + CACHE_TTL_MS, value: analyticsRefresh };
  return analyticsRefresh;
}

export async function getInitialAdminDashboardAnalytics(): Promise<DashboardAnalytics> {
  const fallback = lastSuccessfulAnalytics ?? await loadPersistedAnalytics();
  if (fallback) {
    lastSuccessfulAnalytics = fallback;
    return asPersistentFallback(fallback, "Opgeslagen GA4-gegevens worden direct getoond.");
  }
  return getAdminDashboardAnalytics();
}
