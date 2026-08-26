import type {
  DashboardAnalytics,
  DashboardForecastPoint,
  DashboardIssue,
  DashboardTrendPoint,
} from "@/lib/admin-dashboard-contract";

export type DashboardReportRow = Record<string, string | number>;

export type DashboardRevenueSource = {
  status: DashboardAnalytics["status"];
  generatedAt: string;
  message: string;
  revenueToday: number | null;
  daily: DashboardTrendPoint[];
};

function number(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function addDays(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
  );
}

export function combineDashboardSources(
  ga4: DashboardAnalytics,
  mollie: DashboardRevenueSource
): DashboardAnalytics {
  const status =
    ga4.status === "live" && mollie.status === "live"
      ? "live"
      : ga4.status === "unavailable" && mollie.status === "unavailable"
        ? "unavailable"
        : "partial";
  const generatedAt = [ga4.generatedAt, mollie.generatedAt]
    .filter((value) => Number.isFinite(new Date(value).getTime()))
    .sort()
    .at(-1) ?? new Date().toISOString();

  return {
    ...ga4,
    status,
    generatedAt,
    message:
      status === "live"
        ? "Mollie-omzet en GA4-verkeer zijn live."
        : `${mollie.message} ${ga4.message}`,
    metrics: {
      ...ga4.metrics,
      revenueToday: mollie.revenueToday,
    },
    revenueDaily: mollie.daily,
  };
}

export function buildDashboardForecast(
  input: DashboardTrendPoint[],
  horizon = 7
): DashboardAnalytics["forecast"] {
  const rows = [...input].filter((row) => !row.partial).sort((a, b) => a.date.localeCompare(b.date)).slice(-56);
  const training = rows.slice(-28);
  const values = training.map((row) => row.sessions);
  const count = values.length;
  if (count < 3) {
    return { confidence: "onvoldoende", trainingDays: count, reason: "Minimaal drie volledige dagen zijn nodig voor een indicatieve verwachting.", points: [] };
  }

  const weights = values.map((_, index) => index + 1);
  const weightTotal = weights.reduce((sum, value) => sum + value, 0);
  const weightedMean = values.reduce((sum, value, index) => sum + value * weights[index], 0) / weightTotal;
  const xMean = (count - 1) / 2;
  const yMean = values.reduce((sum, value) => sum + value, 0) / count;
  const numerator = values.reduce((sum, value, index) => sum + (index - xMean) * (value - yMean), 0);
  const denominator = values.reduce((sum, _, index) => sum + (index - xMean) ** 2, 0) || 1;
  const slope = (numerator / denominator) * Math.min(0.35, count / 80);
  const variability = Math.max(standardDeviation(values), weightedMean * 0.18, 1);
  const lastDate = training.at(-1)?.date ?? new Date().toISOString().slice(0, 10);
  const points: DashboardForecastPoint[] = Array.from({ length: horizon }, (_, index) => {
    const step = index + 1;
    const expected = Math.max(0, weightedMean + slope * step);
    const spread = variability * (1.1 + Math.sqrt(step) * 0.2);
    return { date: addDays(lastDate, step), expected: Math.round(expected), low: Math.round(Math.max(0, expected - spread)), high: Math.round(expected + spread) };
  });
  const confidence = count >= 28 ? "middel" : "laag";
  return {
    confidence,
    trainingDays: count,
    reason: confidence === "laag" ? "De historie is kort; gebruik dit als capaciteitsindicatie, niet als financieel doel." : "Gewogen verwachting op basis van volledige recente meetdagen en een gedempte trend.",
    points,
  };
}

function findEvent(events: DashboardReportRow[], names: string[]): number {
  return number(events.find((event) => names.includes(String(event.eventName)))?.eventCount);
}

export function buildDashboardFunnel(events: DashboardReportRow[]): DashboardAnalytics["funnel"] {
  return {
    cart: findEvent(events, ["add_to_cart", "ads_conversion_Winkelwagentje_1"]),
    checkout: findEvent(events, ["begin_checkout", "ads_conversion_Betalen_1"]),
    purchase: findEvent(events, ["purchase", "ads_conversion_Aankoop_1"]),
  };
}

export function buildDashboardIssues(input: {
  summary: DashboardReportRow;
  pages: DashboardReportRow[];
  sources: DashboardReportRow[];
  channels: DashboardReportRow[];
  events: DashboardReportRow[];
  coverageDays: number;
}): { issues: DashboardIssue[]; funnel: DashboardAnalytics["funnel"] } {
  const { summary, pages, sources, channels, events, coverageDays } = input;
  const issues: DashboardIssue[] = [];
  const totalViews = number(summary.screenPageViews);
  const pageNotSet = pages.find((row) => String(row.pageTitle) === "(not set)");
  const notSetShare = totalViews ? number(pageNotSet?.screenPageViews) / totalViews : 0;
  const mollie = sources.find((row) => /mollie\.com/i.test(String(row.sessionSourceMedium)));
  const totalSessions = number(summary.sessions);
  const direct = channels.find((row) => String(row.sessionDefaultChannelGroup) === "Direct");
  const directShare = totalSessions ? number(direct?.sessions) / totalSessions : 0;
  const { cart, checkout, purchase } = buildDashboardFunnel(events);
  const checkoutCount = checkout ?? 0;
  const purchaseCount = purchase ?? 0;
  const purchaseRate = checkoutCount ? purchaseCount / checkoutCount : 0;

  if (purchaseCount > 0 && number(summary.transactions) === 0 && number(summary.purchaseRevenue) === 0) issues.push({ id: "ecommerce-measurement", severity: "critical", title: "Aankopen komen niet als omzet binnen", evidence: `${purchaseCount} aankoopsignalen, maar geen standaard GA4-transacties of omzet.`, action: "Controleer of purchase na een bevestigde betaling transaction_id, value, currency en items bevat." });
  if (notSetShare >= 0.1) issues.push({ id: "page-title-not-set", severity: "critical", title: "Paginaweergaven missen context", evidence: `${Math.round(notSetShare * 100)}% van de weergaven staat onder (not set).`, action: "Controleer consent timing en SPA-routewissels; verstuur titel en locatie pas na de definitieve route." });
  if (number(mollie?.sessions) > 0) issues.push({ id: "mollie-self-referral", severity: "high", title: "Mollie overschrijft de verkeersbron", evidence: `${number(mollie?.sessions)} sessies worden aan mollie.com / referral toegeschreven.`, action: "Controleer de ongewenste verwijzing, cross-domaininstelling en betaal-return-URL." });
  if (checkoutCount > 0 && purchaseRate < 0.4) issues.push({ id: "checkout-dropoff", severity: "high", title: "Veel betaalstarts eindigen niet in een aankoopsignaal", evidence: `${checkoutCount} betaalstarts leiden tot ${purchaseCount} aankoopsignalen (${Math.round(purchaseRate * 100)}%).`, action: "Splits uitval uit per apparaat, betaalmethode en foutstatus en controleer de returnpagina." });
  if (directShare >= 0.6) issues.push({ id: "direct-share", severity: "high", title: "Direct verkeer is uitzonderlijk dominant", evidence: `${Math.round(directShare * 100)}% van de sessies valt onder Direct.`, action: "Gebruik consistente UTM-tags voor e-mail, social, WhatsApp en QR-links." });
  if (number(summary.engagementRate) >= 0.6) issues.push({ id: "engagement-positive", severity: "positive", title: "Bezoekers tonen sterke betrokkenheid", evidence: `${Math.round(number(summary.engagementRate) * 100)}% betrokkenheid in de meetperiode.`, action: "Bouw verder op pagina’s en verkeersbronnen met de hoogste betrokkenheid." });
  if (coverageDays < 28) issues.push({ id: "short-history", severity: "info", title: "Forecast heeft nog beperkte historie", evidence: `${coverageDays} volledige meetdagen beschikbaar.`, action: "Gebruik de verwachting als capaciteitsindicatie tot minimaal 28 volledige dagen beschikbaar zijn." });
  return { issues, funnel: { cart, checkout, purchase } };
}
