// The whitelist of data an admin may put on the dashboard. Nothing outside this registry can
// be queried: the server checks every widget's source, metric, dimension, filter, period and
// granularity against it before any data is read. That is what makes the no-code builder safe
// without ever accepting SQL, Prisma or an expression from the browser.

import type {
  Aggregation,
  Comparison,
  DatePreset,
  FilterOperator,
  Granularity,
  NumberFormat,
} from "./schema";

/** What a source returns, which decides which visualizations can show it. */
export type SourceShape =
  | "scalar" // one number, optionally with a comparison
  | "timeSeries" // one or more measures over time
  | "categorical" // measures grouped by a dimension
  | "steps" // ordered funnel stages
  | "table" // rows for a list or ranking
  | "matrix" // two dimensions, one measure (heatmap, cohort)
  | "goal" // actual against a target
  | "normalized"; // 3-8 dimensions scored 0-100

export type SourceMetric = {
  field: string;
  label: string;
  format: NumberFormat;
  aggregations: readonly Aggregation[];
  /** Shown in the builder and as the widget's help text. */
  definition: string;
};

export type SourceDimension = {
  field: string;
  label: string;
  type: "date" | "category";
  /** Roughly how many distinct values; keeps part-of-whole charts honest. */
  cardinality: "low" | "medium" | "high";
};

export type SourceFilter = {
  field: string;
  label: string;
  operators: readonly FilterOperator[];
  /** When set, the only values the server accepts. */
  values?: readonly { value: string; label: string }[];
};

export type DashboardSource = {
  id: string;
  label: string;
  category: "handel" | "verkeer" | "operatie" | "catalogus" | "gezondheid";
  shape: SourceShape;
  /** Plain Dutch, shown under the widget so a reader knows what they are looking at. */
  description: string;
  /** Where the numbers come from, shown on the widget itself. */
  origin: string;
  metrics: readonly SourceMetric[];
  dimensions: readonly SourceDimension[];
  filters: readonly SourceFilter[];
  datePresets: readonly DatePreset[];
  granularities: readonly Granularity[];
  comparisons: readonly Comparison[];
  defaultVisualization: string;
  /** Narrows what the shape would otherwise allow; empty means "whatever fits the shape". */
  onlyVisualizations?: readonly string[];
  /** Reading this source needs this permission; everything needs an admin session. */
  permission: { resource: "orders" | "products" | "analytics"; action: "read" };
  /** Where clicking the widget leads. */
  deepLink?: string;
  /** Measured data that is not yet available is never silently shown as zero. */
  mayBeUnavailable: boolean;
};

const MONEY: readonly Aggregation[] = ["sum", "avg", "min", "max"];
const COUNT: readonly Aggregation[] = ["sum", "count", "avg", "max"];
const ALL_PRESETS: readonly DatePreset[] = ["today", "yesterday", "last_7_days", "last_28_days", "last_30_days", "last_90_days", "this_month", "last_month", "this_year", "custom"];
const DAY_GRAIN: readonly Granularity[] = ["day", "week", "month"];
const BOTH_COMPARISONS: readonly Comparison[] = ["none", "previous_period", "previous_year"];

export const DASHBOARD_SOURCES: readonly DashboardSource[] = [
  {
    id: "mollie_revenue",
    label: "Omzet (Mollie)",
    category: "handel",
    shape: "timeSeries",
    description: "Betaalde omzet uit Mollie, na aftrek van refunds en chargebacks.",
    origin: "Mollie",
    metrics: [
      { field: "netRevenue", label: "Netto omzet", format: "euro", aggregations: MONEY, definition: "Betaald bedrag min terugbetalingen en chargebacks. Alleen live betalingen in euro's." },
      { field: "grossRevenue", label: "Bruto omzet", format: "euro", aggregations: MONEY, definition: "Betaald bedrag vóór terugbetalingen en chargebacks." },
      { field: "refunds", label: "Terugbetalingen", format: "euro", aggregations: MONEY, definition: "Het bedrag dat is terugbetaald aan klanten." },
      { field: "chargebacks", label: "Chargebacks", format: "euro", aggregations: MONEY, definition: "Het bedrag dat door de bank is teruggeboekt." },
      { field: "paidOrders", label: "Betaalde bestellingen", format: "integer", aggregations: COUNT, definition: "Het aantal betalingen met status betaald." },
      { field: "averageOrderValue", label: "Gemiddelde orderwaarde", format: "euro", aggregations: ["avg"], definition: "Netto omzet gedeeld door het aantal betaalde bestellingen." },
    ],
    dimensions: [{ field: "date", label: "Dag", type: "date", cardinality: "high" }],
    filters: [],
    datePresets: ALL_PRESETS,
    granularities: DAY_GRAIN,
    comparisons: BOTH_COMPARISONS,
    defaultVisualization: "line",
    permission: { resource: "orders", action: "read" },
    deepLink: "/admin/facturen",
    mayBeUnavailable: true,
  },
  {
    id: "ga4_traffic",
    label: "Verkeer (GA4)",
    category: "verkeer",
    shape: "timeSeries",
    description: "Bezoek aan de webshop volgens Google Analytics 4.",
    origin: "GA4",
    metrics: [
      { field: "sessions", label: "Sessies", format: "integer", aggregations: COUNT, definition: "Het aantal bezoeken. Eén bezoeker kan meerdere sessies hebben." },
      { field: "views", label: "Weergaven", format: "integer", aggregations: COUNT, definition: "Het aantal bekeken pagina's." },
      { field: "engagementRate", label: "Betrokkenheid", format: "percent", aggregations: ["avg"], definition: "Betrokken sessies gedeeld door alle sessies." },
      { field: "keyEvents", label: "Belangrijke events", format: "integer", aggregations: COUNT, definition: "Events die in GA4 als belangrijk zijn gemarkeerd." },
    ],
    dimensions: [{ field: "date", label: "Dag", type: "date", cardinality: "high" }],
    filters: [],
    datePresets: ALL_PRESETS,
    granularities: DAY_GRAIN,
    comparisons: BOTH_COMPARISONS,
    defaultVisualization: "line",
    permission: { resource: "analytics", action: "read" },
    mayBeUnavailable: true,
  },
  {
    id: "ga4_realtime",
    label: "Actieve bezoekers (GA4)",
    category: "verkeer",
    shape: "scalar",
    description: "Bezoekers die nu op de webshop zijn.",
    origin: "GA4 realtime",
    metrics: [{ field: "activeUsers", label: "Actieve bezoekers", format: "integer", aggregations: ["last"], definition: "Bezoekers in de afgelopen dertig minuten." }],
    dimensions: [],
    filters: [],
    datePresets: ["today"],
    granularities: [],
    comparisons: ["none"],
    defaultVisualization: "kpi",
    onlyVisualizations: ["kpi"],
    permission: { resource: "analytics", action: "read" },
    mayBeUnavailable: true,
  },
  {
    id: "ga4_forecast",
    label: "Sessieforecast",
    category: "verkeer",
    shape: "timeSeries",
    description: "Verwachte sessies voor de komende zeven dagen, met een betrouwbaarheidsband.",
    origin: "GA4, eigen berekening",
    metrics: [
      { field: "expected", label: "Verwacht", format: "integer", aggregations: ["sum"], definition: "Het middelpunt van de verwachting." },
      { field: "low", label: "Ondergrens", format: "integer", aggregations: ["sum"], definition: "De onderkant van de betrouwbaarheidsband." },
      { field: "high", label: "Bovengrens", format: "integer", aggregations: ["sum"], definition: "De bovenkant van de betrouwbaarheidsband." },
    ],
    dimensions: [{ field: "date", label: "Dag", type: "date", cardinality: "low" }],
    filters: [],
    datePresets: ["today"],
    granularities: ["day"],
    comparisons: ["none"],
    defaultVisualization: "area",
    permission: { resource: "analytics", action: "read" },
    mayBeUnavailable: true,
  },
  {
    id: "ga4_funnel",
    label: "Conversiefunnel",
    category: "verkeer",
    shape: "steps",
    description: "De stappen van productweergave tot aankoop.",
    origin: "GA4",
    metrics: [{ field: "reach", label: "Bereik", format: "integer", aggregations: ["sum"], definition: "Het aantal dat deze stap haalde. Waar mogelijk unieke sessies, anders eventaantallen; dat staat bij de widget." }],
    dimensions: [{ field: "step", label: "Stap", type: "category", cardinality: "low" }],
    filters: [],
    datePresets: ALL_PRESETS,
    granularities: [],
    comparisons: ["none", "previous_period"],
    defaultVisualization: "funnel",
    onlyVisualizations: ["funnel", "table", "bar_horizontal"],
    permission: { resource: "analytics", action: "read" },
    mayBeUnavailable: true,
  },
  {
    id: "order_counts",
    label: "Bestellingen",
    category: "handel",
    shape: "categorical",
    description: "Bestellingen in de webshop, te groeperen op status of bezorgwijze.",
    origin: "Webshopdatabase",
    metrics: [
      { field: "orders", label: "Bestellingen", format: "integer", aggregations: COUNT, definition: "Het aantal bestellingen." },
      { field: "revenue", label: "Orderwaarde", format: "euro", aggregations: MONEY, definition: "De som van de ordertotalen." },
    ],
    dimensions: [
      { field: "status", label: "Status", type: "category", cardinality: "low" },
      { field: "deliveryMethod", label: "Bezorgwijze", type: "category", cardinality: "low" },
      { field: "date", label: "Dag", type: "date", cardinality: "high" },
      { field: "country", label: "Land", type: "category", cardinality: "low" },
    ],
    filters: [
      {
        field: "status",
        label: "Status",
        operators: ["eq", "ne", "in", "not_in"],
        values: [
          { value: "PENDING", label: "Openstaand" },
          { value: "PAID", label: "Betaald" },
          { value: "FULFILLED", label: "Verzonden" },
          { value: "CANCELLED", label: "Geannuleerd" },
          { value: "REFUNDED", label: "Terugbetaald" },
        ],
      },
      {
        field: "deliveryMethod",
        label: "Bezorgwijze",
        operators: ["eq", "ne"],
        values: [
          { value: "SHIPPING", label: "Verzenden" },
          { value: "PICKUP", label: "Afhalen op de markt" },
        ],
      },
    ],
    datePresets: ALL_PRESETS,
    granularities: DAY_GRAIN,
    comparisons: BOTH_COMPARISONS,
    defaultVisualization: "bar_vertical",
    permission: { resource: "orders", action: "read" },
    deepLink: "/admin/bestellingen",
    mayBeUnavailable: false,
  },
  {
    id: "recent_orders",
    label: "Recente bestellingen",
    category: "operatie",
    shape: "table",
    description: "De nieuwste bestellingen, met status en bedrag.",
    origin: "Webshopdatabase",
    metrics: [{ field: "total", label: "Totaal", format: "euro", aggregations: ["sum"], definition: "Het ordertotaal inclusief btw en verzendkosten." }],
    dimensions: [{ field: "order", label: "Bestelling", type: "category", cardinality: "high" }],
    filters: [],
    datePresets: ["last_7_days", "last_28_days", "last_30_days"],
    granularities: [],
    comparisons: ["none"],
    defaultVisualization: "table",
    onlyVisualizations: ["table"],
    permission: { resource: "orders", action: "read" },
    deepLink: "/admin/bestellingen",
    mayBeUnavailable: false,
  },
  {
    id: "catalog_counts",
    label: "Catalogus",
    category: "catalogus",
    shape: "scalar",
    description: "Het aantal actieve producten en categorieën.",
    origin: "Webshopdatabase",
    metrics: [
      { field: "activeProducts", label: "Actieve producten", format: "integer", aggregations: ["last"], definition: "Producten die online staan." },
      { field: "activeCategories", label: "Categorieën", format: "integer", aggregations: ["last"], definition: "Categorieën die online staan." },
    ],
    dimensions: [],
    filters: [],
    datePresets: ["today"],
    granularities: [],
    comparisons: ["none"],
    defaultVisualization: "kpi",
    onlyVisualizations: ["kpi"],
    permission: { resource: "products", action: "read" },
    deepLink: "/admin/producten",
    mayBeUnavailable: false,
  },
  {
    id: "analysis_signals",
    label: "Verbetersignalen",
    category: "gezondheid",
    shape: "table",
    description: "Wat de analyse van de webshop heeft gevonden, op volgorde van ernst.",
    origin: "Webshopanalyse",
    metrics: [{ field: "findings", label: "Bevindingen", format: "integer", aggregations: ["count"], definition: "Het aantal open bevindingen." }],
    dimensions: [{ field: "severity", label: "Ernst", type: "category", cardinality: "low" }],
    filters: [],
    datePresets: ["today"],
    granularities: [],
    comparisons: ["none"],
    defaultVisualization: "table",
    onlyVisualizations: ["table", "bar_horizontal", "kpi"],
    permission: { resource: "analytics", action: "read" },
    mayBeUnavailable: false,
  },
];

const BY_ID = new Map(DASHBOARD_SOURCES.map((source) => [source.id, source]));

export function getDashboardSource(id: string): DashboardSource | undefined {
  return BY_ID.get(id);
}

export function sourceMetric(source: DashboardSource, field: string): SourceMetric | undefined {
  return source.metrics.find((metric) => metric.field === field);
}

export function sourceDimension(source: DashboardSource, field: string): SourceDimension | undefined {
  return source.dimensions.find((dimension) => dimension.field === field);
}

export function sourceFilter(source: DashboardSource, field: string): SourceFilter | undefined {
  return source.filters.find((filter) => filter.field === field);
}
