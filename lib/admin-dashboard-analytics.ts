import "server-only";

import { google } from "googleapis";
import { z } from "zod";
import type {
  DashboardAnalytics,
  DashboardTrendPoint,
} from "@/lib/admin-dashboard-contract";
import { EMPTY_DASHBOARD_ANALYTICS } from "@/lib/admin-dashboard-contract";
import {
  buildDashboardForecast,
  buildDashboardFunnel,
  buildDashboardIssues,
  combineDashboardSources,
} from "@/lib/admin-dashboard-analysis";
import {
  buildMollieRevenue,
  type MollieRevenuePayment,
} from "@/lib/admin-dashboard-revenue";
import { getMollieClient } from "@/lib/mollie";
import { getSetting, setSetting } from "@/lib/settings";

const PROPERTY_ID = process.env.GA4_PROPERTY_ID?.trim() ?? "";
const ANALYTICS_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const REQUEST_TIMEOUT_MS = 8_000;
const CACHE_TTL_MS = 60_000;
const TRANSIENT_RETRY_DELAY_MS = 250;
const GA4_SNAPSHOT_SETTING_KEY = "analytics.ga4.dashboard.snapshot.v2";
const GA4_SNAPSHOT_VERSION = 2;
const MOLLIE_REVENUE_SNAPSHOT_SETTING_KEY = "analytics.mollie.revenue.snapshot.v1";
const MOLLIE_REVENUE_SNAPSHOT_VERSION = 1;
const MOLLIE_PAGE_SIZE = 250;
const MOLLIE_MAX_PAGES = 40;
const MOLLIE_CREATION_LOOKBACK_DAYS = 191;

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
  revenueDaily: z.array(z.object({
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

const mollieRevenueSchema = z.object({
  status: z.enum(["live", "partial", "unavailable"]),
  generatedAt: z.string().datetime(),
  message: z.string(),
  revenueToday: nullableMetricSchema,
  daily: z.array(z.object({
    date: z.string(),
    sessions: z.number().finite(),
    revenue: z.number().finite(),
    partial: z.boolean().optional(),
  })).max(100),
  paidPayments: z.number().int().nonnegative(),
  unsupportedCurrencies: z.number().int().nonnegative(),
});

const persistedMollieRevenueSchema = z.object({
  version: z.literal(MOLLIE_REVENUE_SNAPSHOT_VERSION),
  data: mollieRevenueSchema,
});

type MollieDashboardRevenue = z.infer<typeof mollieRevenueSchema>;

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

let ga4Cache:
  | { expiresAt: number; value: Promise<DashboardAnalytics> }
  | undefined;
let ga4Refresh: Promise<DashboardAnalytics> | undefined;
let lastSuccessfulGa4: DashboardAnalytics | undefined;
let mollieCache:
  | { expiresAt: number; value: Promise<MollieDashboardRevenue> }
  | undefined;
let mollieRefresh: Promise<MollieDashboardRevenue> | undefined;
let lastSuccessfulMollieRevenue: MollieDashboardRevenue | undefined;
let lastForcedRefreshAt = 0;

const EMPTY_MOLLIE_REVENUE: MollieDashboardRevenue = {
  status: "unavailable",
  generatedAt: new Date(0).toISOString(),
  message: "Mollie-omzet is momenteel niet beschikbaar.",
  revenueToday: null,
  daily: [],
  paidPayments: 0,
  unsupportedCurrencies: 0,
};

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
    message: `${reason} Laatst geldige GA4-verkeersmeting: ${snapshotMoment(data.generatedAt)}.`,
  };
}

function asMolliePersistentFallback(
  data: MollieDashboardRevenue,
  reason: string
): MollieDashboardRevenue {
  return {
    ...data,
    status: "partial",
    message: `${reason} Laatst geldige Mollie-meting: ${snapshotMoment(data.generatedAt)}.`,
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

async function loadPersistedMollieRevenue(): Promise<MollieDashboardRevenue | undefined> {
  try {
    const raw = await getSetting(MOLLIE_REVENUE_SNAPSHOT_SETTING_KEY);
    if (!raw) return undefined;
    const parsed = persistedMollieRevenueSchema.safeParse(JSON.parse(raw));
    if (!parsed.success || parsed.data.data.status === "unavailable") return undefined;
    return parsed.data.data;
  } catch (error) {
    console.error("Admin dashboard Mollie snapshot read failed", {
      code: error instanceof Error ? error.message : "UNKNOWN",
    });
    return undefined;
  }
}

async function persistMollieRevenue(data: MollieDashboardRevenue): Promise<void> {
  try {
    await setSetting(
      MOLLIE_REVENUE_SNAPSHOT_SETTING_KEY,
      JSON.stringify({ version: MOLLIE_REVENUE_SNAPSHOT_VERSION, data })
    );
  } catch (error) {
    console.error("Admin dashboard Mollie snapshot write failed", {
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

async function withTimeout<T>(
  promise: Promise<T>,
  milliseconds: number,
  timeoutCode: "GA4_TIMEOUT" | "MOLLIE_TIMEOUT"
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(timeoutCode)), milliseconds);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function isRetryableDependencyError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    code?: string | number;
    statusCode?: number;
    message?: string;
    response?: { status?: number };
  };
  const status = Number(candidate.response?.status ?? candidate.statusCode ?? candidate.code);
  return (
    status === 408 ||
    status === 429 ||
    status >= 500 ||
    candidate.code === "ETIMEDOUT" ||
    candidate.code === "ECONNRESET" ||
    candidate.message === "GA4_TIMEOUT" ||
    candidate.message === "MOLLIE_TIMEOUT"
  );
}

async function requestWithRetry<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isRetryableDependencyError(error)) throw error;
    await new Promise((resolve) => setTimeout(resolve, TRANSIENT_RETRY_DELAY_MS));
    return operation();
  }
}

async function fetchFreshAnalytics(): Promise<DashboardAnalytics> {
  try {
    if (!/^\d+$/.test(PROPERTY_ID)) throw new Error("GA4_NOT_CONFIGURED");
    const auth = new google.auth.GoogleAuth({ scopes: [ANALYTICS_SCOPE] });
    const authClient = await withTimeout(auth.getClient(), REQUEST_TIMEOUT_MS, "GA4_TIMEOUT");
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
        ], 1)
      ),
      request("runReport", reportBody("89daysAgo", "yesterday", ["date"], ["sessions"], 100)),
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
        revenue: 0,
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
          ? "Live GA4-verkeersgegevens"
          : "Een deel van de GA4-verkeersgegevens kon niet worden vernieuwd.",
      metrics: {
        activeVisitors: results[0]?.status === "fulfilled" ? number(realtime?.activeUsers) : null,
        revenueToday: null,
        sessions: results[1]?.status === "fulfilled" ? number(today.sessions) : null,
        views: results[1]?.status === "fulfilled" ? number(today.screenPageViews) : null,
        engagement: results[1]?.status === "fulfilled" ? number(today.engagementRate) : null,
        keyEvents: results[1]?.status === "fulfilled" ? number(today.keyEvents) : null,
      },
      daily,
      revenueDaily: [],
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

async function fetchFreshMollieRevenue(): Promise<MollieDashboardRevenue> {
  try {
    if (!process.env.MOLLIE_API_KEY?.startsWith("live_")) {
      throw new Error("MOLLIE_LIVE_KEY_REQUIRED");
    }
    const now = new Date();
    const creationCutoff = new Date(
      now.getTime() - MOLLIE_CREATION_LOOKBACK_DAYS * 24 * 60 * 60 * 1000
    );
    const payments: MollieRevenuePayment[] = [];
    let page = await requestWithRetry(() =>
      withTimeout(
        getMollieClient().payments.page({ limit: MOLLIE_PAGE_SIZE, sort: "desc" }),
        REQUEST_TIMEOUT_MS,
        "MOLLIE_TIMEOUT"
      )
    );
    let pagesRead = 0;
    let reachedCutoff = false;

    while (true) {
      pagesRead += 1;
      payments.push(...page);
      const oldestCreatedAt = page.at(-1)?.createdAt;
      if (oldestCreatedAt) {
        const oldest = new Date(oldestCreatedAt);
        if (Number.isFinite(oldest.getTime()) && oldest < creationCutoff) {
          reachedCutoff = true;
          break;
        }
      }
      const nextPage = page.nextPage;
      if (!nextPage || pagesRead >= MOLLIE_MAX_PAGES) break;
      page = await requestWithRetry(() =>
        withTimeout(nextPage(), REQUEST_TIMEOUT_MS, "MOLLIE_TIMEOUT")
      );
    }

    const revenue = buildMollieRevenue(payments, now);
    const truncated = Boolean(page.nextPage) && !reachedCutoff && pagesRead >= MOLLIE_MAX_PAGES;
    const status = truncated || revenue.unsupportedCurrencies > 0 ? "partial" : "live";
    const details = [
      truncated ? "De paginalimiet is bereikt; oudere betalingen ontbreken mogelijk." : "",
      revenue.unsupportedCurrencies > 0
        ? `${revenue.unsupportedCurrencies} betaling(en) met een andere valuta zijn niet opgeteld.`
        : "",
    ].filter(Boolean).join(" ");

    return {
      status,
      generatedAt: now.toISOString(),
      message:
        status === "live"
          ? "Live Mollie-omzet na refunds en chargebacks."
          : `Mollie-omzet is gedeeltelijk geladen. ${details}`.trim(),
      revenueToday: revenue.revenueToday,
      daily: revenue.daily,
      paidPayments: revenue.paidPayments,
      unsupportedCurrencies: revenue.unsupportedCurrencies,
    };
  } catch (error) {
    console.error("Admin dashboard Mollie revenue refresh failed", {
      code: error instanceof Error ? error.message : "UNKNOWN",
    });
    return {
      ...EMPTY_MOLLIE_REVENUE,
      generatedAt: new Date().toISOString(),
    };
  }
}

function getGa4DashboardAnalytics(options?: { force?: boolean }) {
  const now = Date.now();
  if (ga4Refresh) return ga4Refresh;
  if (!options?.force && ga4Cache && ga4Cache.expiresAt > now) {
    return ga4Cache.value;
  }
  const value = fetchFreshAnalytics().then(async (fresh) => {
    if (fresh.status !== "unavailable") {
      lastSuccessfulGa4 = fresh;
      await persistAnalytics(fresh);
      return fresh;
    }
    const fallback = lastSuccessfulGa4 ?? await loadPersistedAnalytics();
    if (fallback) {
      lastSuccessfulGa4 = fallback;
      return asPersistentFallback(
        fallback,
        "Live vernieuwen is mislukt; de laatst opgeslagen gegevens worden getoond."
      );
    }
    return fresh;
  });
  ga4Refresh = value.finally(() => {
    ga4Refresh = undefined;
  });
  ga4Cache = { expiresAt: now + CACHE_TTL_MS, value: ga4Refresh };
  return ga4Refresh;
}

function getMollieDashboardRevenue(options?: { force?: boolean }) {
  const now = Date.now();
  if (mollieRefresh) return mollieRefresh;
  if (!options?.force && mollieCache && mollieCache.expiresAt > now) {
    return mollieCache.value;
  }
  const value = fetchFreshMollieRevenue().then(async (fresh) => {
    if (fresh.status !== "unavailable") {
      lastSuccessfulMollieRevenue = fresh;
      await persistMollieRevenue(fresh);
      return fresh;
    }
    const fallback = lastSuccessfulMollieRevenue ?? await loadPersistedMollieRevenue();
    if (fallback) {
      lastSuccessfulMollieRevenue = fallback;
      return asMolliePersistentFallback(
        fallback,
        "Live vernieuwen is mislukt; de laatst opgeslagen omzet wordt getoond."
      );
    }
    return fresh;
  });
  mollieRefresh = value.finally(() => {
    mollieRefresh = undefined;
  });
  mollieCache = { expiresAt: now + CACHE_TTL_MS, value: mollieRefresh };
  return mollieRefresh;
}

export async function getAdminDashboardAnalytics(
  options?: { force?: boolean }
): Promise<DashboardAnalytics> {
  const now = Date.now();
  const forceAllowed = Boolean(options?.force && now - lastForcedRefreshAt >= 15_000);
  if (forceAllowed) lastForcedRefreshAt = now;
  const [ga4, mollie] = await Promise.all([
    getGa4DashboardAnalytics({ force: forceAllowed }),
    getMollieDashboardRevenue({ force: forceAllowed }),
  ]);
  return combineDashboardSources(ga4, mollie);
}

export async function getInitialAdminDashboardAnalytics(): Promise<DashboardAnalytics> {
  const [storedGa4, storedMollie] = await Promise.all([
    lastSuccessfulGa4 ?? loadPersistedAnalytics(),
    lastSuccessfulMollieRevenue ?? loadPersistedMollieRevenue(),
  ]);
  if (storedGa4 || storedMollie) {
    const ga4 = storedGa4
      ? asPersistentFallback(storedGa4, "Opgeslagen GA4-verkeersgegevens worden direct getoond.")
      : EMPTY_DASHBOARD_ANALYTICS;
    const mollie = storedMollie
      ? asMolliePersistentFallback(storedMollie, "Opgeslagen Mollie-omzet wordt direct getoond.")
      : EMPTY_MOLLIE_REVENUE;
    if (storedGa4) lastSuccessfulGa4 = storedGa4;
    if (storedMollie) lastSuccessfulMollieRevenue = storedMollie;
    return combineDashboardSources(ga4, mollie);
  }
  return getAdminDashboardAnalytics();
}
