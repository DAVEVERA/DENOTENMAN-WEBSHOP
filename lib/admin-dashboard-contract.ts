export type DashboardDisplayMode = "number" | "chart";

export type DashboardWidgetSource =
  | "activeVisitors"
  | "revenueToday"
  | "sessions"
  | "views"
  | "engagement"
  | "keyEvents"
  | "activeProducts"
  | "categories"
  | "totalOrders"
  | "pendingOrders"
  | "recentOrders"
  | "forecast"
  | "dailyRevenue"
  | "funnel"
  | "improvementSignals"
  | "improvements";

export type DashboardWidgetConfig = {
  id: string;
  source: DashboardWidgetSource;
  title: string;
  text: string;
  display: DashboardDisplayMode;
  hidden: boolean;
  custom: boolean;
};

export type DashboardPreferences = {
  version: 1;
  widgets: DashboardWidgetConfig[];
};

export type DashboardTrendPoint = {
  date: string;
  sessions: number;
  revenue: number;
  partial?: boolean;
};

export type DashboardForecastPoint = {
  date: string;
  expected: number;
  low: number;
  high: number;
};

export type DashboardIssueSeverity = "critical" | "high" | "positive" | "info";

export type DashboardIssue = {
  id: string;
  severity: DashboardIssueSeverity;
  title: string;
  evidence: string;
  action: string;
};

export type DashboardAnalytics = {
  status: "live" | "partial" | "unavailable";
  generatedAt: string;
  propertyId: string;
  message: string;
  metrics: {
    activeVisitors: number | null;
    revenueToday: number | null;
    sessions: number | null;
    views: number | null;
    engagement: number | null;
    keyEvents: number | null;
  };
  daily: DashboardTrendPoint[];
  forecast: {
    confidence: "onvoldoende" | "laag" | "middel" | "hoog";
    trainingDays: number;
    reason: string;
    points: DashboardForecastPoint[];
  };
  funnel: {
    cart: number | null;
    checkout: number | null;
    purchase: number | null;
  };
  signals: {
    critical: number;
    high: number;
    positive: number;
  };
  issues: DashboardIssue[];
};

export const DASHBOARD_WIDGET_SOURCES: ReadonlyArray<{
  source: DashboardWidgetSource;
  label: string;
}> = [
  { source: "activeVisitors", label: "Actieve bezoekers" },
  { source: "revenueToday", label: "Omzet vandaag" },
  { source: "sessions", label: "Sessies" },
  { source: "views", label: "Weergaven" },
  { source: "engagement", label: "Betrokkenheid" },
  { source: "keyEvents", label: "Belangrijke events" },
  { source: "activeProducts", label: "Actieve producten" },
  { source: "categories", label: "Categorieën" },
  { source: "totalOrders", label: "Bestellingen totaal" },
  { source: "pendingOrders", label: "Openstaand" },
  { source: "recentOrders", label: "Recente bestellingen" },
  { source: "forecast", label: "Forecast" },
  { source: "dailyRevenue", label: "Omzet per dag" },
  { source: "funnel", label: "Van winkelwagen naar aankoopsignaal" },
  { source: "improvementSignals", label: "Verbetersignalen" },
  { source: "improvements", label: "Verbeterpunten" },
];

export const DEFAULT_DASHBOARD_PREFERENCES: DashboardPreferences = {
  version: 1,
  widgets: [
    { id: "active-visitors", source: "activeVisitors", title: "Actieve bezoekers", text: "Afgelopen 30 minuten", display: "number", hidden: false, custom: false },
    { id: "revenue-today", source: "revenueToday", title: "Omzet vandaag", text: "Standaard GA4-transacties", display: "number", hidden: false, custom: false },
    { id: "sessions", source: "sessions", title: "Sessies", text: "Vandaag", display: "number", hidden: false, custom: false },
    { id: "views", source: "views", title: "Weergaven", text: "Vandaag", display: "number", hidden: false, custom: false },
    { id: "engagement", source: "engagement", title: "Betrokkenheid", text: "Betrokken sessies / sessies", display: "number", hidden: false, custom: false },
    { id: "key-events", source: "keyEvents", title: "Belangrijke events", text: "Vandaag", display: "number", hidden: false, custom: false },
    { id: "active-products", source: "activeProducts", title: "Actieve producten", text: "", display: "number", hidden: false, custom: false },
    { id: "categories", source: "categories", title: "Categorieën", text: "", display: "number", hidden: false, custom: false },
    { id: "total-orders", source: "totalOrders", title: "Bestellingen totaal", text: "", display: "number", hidden: false, custom: false },
    { id: "pending-orders", source: "pendingOrders", title: "Openstaand", text: "", display: "number", hidden: false, custom: false },
    { id: "recent-orders", source: "recentOrders", title: "Recente bestellingen", text: "De acht nieuwste bestellingen", display: "number", hidden: false, custom: false },
    { id: "forecast", source: "forecast", title: "Forecast", text: "Verwachte sessies voor de komende zeven dagen", display: "chart", hidden: false, custom: false },
    { id: "daily-revenue", source: "dailyRevenue", title: "Omzet per dag", text: "Afgelopen 30 dagen", display: "chart", hidden: false, custom: false },
    { id: "funnel", source: "funnel", title: "Van winkelwagen naar aankoopsignaal", text: "Eventaantallen kunnen herhaalde acties van dezelfde bezoeker bevatten.", display: "chart", hidden: false, custom: false },
    { id: "improvement-signals", source: "improvementSignals", title: "Verbetersignalen", text: "Eerst oplossen, deze sprint en verder uitbouwen", display: "number", hidden: false, custom: false },
    { id: "improvements", source: "improvements", title: "Verbeterpunten", text: "Acties op basis van de actuele meetgegevens", display: "number", hidden: false, custom: false },
  ],
};

export const EMPTY_DASHBOARD_ANALYTICS: DashboardAnalytics = {
  status: "unavailable",
  generatedAt: new Date(0).toISOString(),
  propertyId: "549991816",
  message: "GA4-gegevens zijn momenteel niet beschikbaar.",
  metrics: {
    activeVisitors: null,
    revenueToday: null,
    sessions: null,
    views: null,
    engagement: null,
    keyEvents: null,
  },
  daily: [],
  forecast: {
    confidence: "onvoldoende",
    trainingDays: 0,
    reason: "Nog geen volledige meetdagen beschikbaar.",
    points: [],
  },
  funnel: { cart: null, checkout: null, purchase: null },
  signals: { critical: 0, high: 0, positive: 0 },
  issues: [],
};

export function retainAnalyticsAfterRefreshFailure(
  current: DashboardAnalytics
): DashboardAnalytics {
  if (current.status === "unavailable") return current;
  return {
    ...current,
    status: "partial",
    message: "Live vernieuwen is mislukt; de laatst geladen GA4-gegevens blijven zichtbaar.",
  };
}
