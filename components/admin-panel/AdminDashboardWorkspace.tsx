"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Plus,
  RefreshCw,
  RotateCcw,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DASHBOARD_WIDGET_SOURCES,
  DEFAULT_DASHBOARD_PREFERENCES,
  EMPTY_DASHBOARD_ANALYTICS,
  type DashboardAnalytics,
  type DashboardPreferences,
  type DashboardTrendPoint,
  type DashboardWidgetConfig,
  type DashboardWidgetSource,
} from "@/lib/admin-dashboard-contract";
import { cn } from "@/lib/cn";

type CommerceStats = {
  activeProducts: number;
  categories: number;
  totalOrders: number;
  pendingOrders: number;
};

type RecentOrder = {
  id: string;
  contactName: string;
  status: string;
  createdAt: string;
  total: string;
};

type Props = {
  commerce: CommerceStats;
  recentOrders: RecentOrder[];
};

const analyticsSources = new Set<DashboardWidgetSource>([
  "activeVisitors",
  "revenueToday",
  "sessions",
  "views",
  "engagement",
  "keyEvents",
  "forecast",
  "dailyRevenue",
  "funnel",
  "improvementSignals",
  "improvements",
]);

const wideSources = new Set<DashboardWidgetSource>([
  "recentOrders",
  "forecast",
  "dailyRevenue",
  "funnel",
  "improvementSignals",
  "improvements",
]);

const heroSources = new Set<DashboardWidgetSource>(["activeVisitors", "revenueToday"]);
const chartCapableSources = new Set<DashboardWidgetSource>([
  "sessions",
  "revenueToday",
  "forecast",
  "dailyRevenue",
  "funnel",
]);

const orderStatusLabels: Record<string, string> = {
  PENDING: "Openstaand",
  PAID: "Betaald",
  PROCESSING: "In behandeling",
  SHIPPED: "Verzonden",
  COMPLETED: "Afgerond",
  CANCELLED: "Geannuleerd",
  REFUNDED: "Terugbetaald",
  FAILED: "Mislukt",
};

function copyPreferences(): DashboardPreferences {
  return {
    version: 1,
    widgets: DEFAULT_DASHBOARD_PREFERENCES.widgets.map((widget) => ({ ...widget })),
  };
}

function euro(value: number | null): string {
  return value === null
    ? "—"
    : new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(value);
}

function integer(value: number | null): string {
  return value === null ? "—" : new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 0 }).format(value);
}

function percent(value: number | null): string {
  return value === null
    ? "—"
    : new Intl.NumberFormat("nl-NL", { style: "percent", maximumFractionDigits: 0 }).format(value);
}

function shortDate(value: string): string {
  return new Intl.DateTimeFormat("nl-NL", { day: "2-digit", month: "2-digit" }).format(
    new Date(`${value}T12:00:00Z`)
  );
}

function SparkBars({ values, label }: { values: number[]; label: string }) {
  const max = Math.max(...values, 1);
  const shown = values.slice(-14);
  if (!shown.length) return <p className="mt-4 text-body-sm text-muted">Nog geen grafiekdata.</p>;
  return (
    <div className="mt-4">
      <div className="flex h-20 items-end gap-1" aria-hidden="true">
        {shown.map((value, index) => (
          <span
            key={`${index}-${value}`}
            className="min-h-1 flex-1 rounded-t bg-accent"
            style={{ height: `${Math.max(5, (value / max) * 100)}%` }}
          />
        ))}
      </div>
      <p className="sr-only">{label}. Waarden van oud naar nieuw: {shown.join(", ")}.</p>
    </div>
  );
}

function MetricContent({
  value,
  display,
  series,
  label,
  hero,
}: {
  value: string;
  display: "number" | "chart";
  series: number[];
  label: string;
  hero?: boolean;
}) {
  if (display === "chart") return <><p className={cn("mt-2 font-heading font-bold tracking-tight", hero ? "text-4xl sm:text-5xl" : "text-3xl")}>{value}</p><SparkBars values={series} label={`${label}, recente ontwikkeling`} /></>;
  return (
    <p className={cn("mt-2 font-heading font-bold tracking-tight", hero ? "text-5xl sm:text-6xl" : "text-4xl")}>
      {value}
    </p>
  );
}

function DailyRevenueChart({ points }: { points: DashboardTrendPoint[] }) {
  const shown = points.slice(-30);
  const max = Math.max(...shown.map((point) => point.revenue), 1);
  if (!shown.length) return <p className="mt-4 text-body-sm text-muted">Nog geen omzetdata beschikbaar.</p>;
  return (
    <div className="mt-5 overflow-x-auto pb-2">
      <div className="flex h-56 min-w-[44rem] items-end gap-2 border-b border-border px-1" aria-hidden="true">
        {shown.map((point) => (
          <div key={point.date} className="group flex h-full min-w-4 flex-1 flex-col justify-end">
            <div
              className="min-h-1 rounded-t bg-[#7B4A2F] transition-colors group-hover:bg-accent-hover"
              style={{ height: `${Math.max(2, (point.revenue / max) * 88)}%` }}
              title={`${shortDate(point.date)}: ${euro(point.revenue)}`}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex min-w-[44rem] justify-between text-xs text-muted">
        <span>{shortDate(shown[0].date)}</span><span>{shortDate(shown.at(-1)?.date ?? shown[0].date)}</span>
      </div>
      <p className="sr-only">Omzet per dag: {shown.map((point) => `${shortDate(point.date)} ${euro(point.revenue)}`).join(", ")}.</p>
    </div>
  );
}

function ForecastChart({ analytics }: { analytics: DashboardAnalytics }) {
  const points = analytics.forecast.points;
  const max = Math.max(...points.map((point) => point.high), 1);
  if (!points.length) return <p className="mt-4 text-body-sm text-muted">{analytics.forecast.reason}</p>;
  return (
    <div className="mt-5">
      <div className="grid h-64 grid-cols-7 items-end gap-2 sm:gap-4" aria-hidden="true">
        {points.map((point) => (
          <div key={point.date} className="flex h-full min-w-0 flex-col items-center justify-end gap-2">
            <span className="text-xs font-bold text-text">{point.expected}</span>
            <div className="relative w-full max-w-12 flex-1">
              <div
                className="absolute bottom-0 left-1/2 w-3/4 -translate-x-1/2 rounded-full bg-accent/25"
                style={{ height: `${Math.max(4, (point.high / max) * 100)}%` }}
                title={`${point.low}–${point.high} sessies`}
              />
              <div
                className="absolute bottom-0 left-1/2 h-1 w-full -translate-x-1/2 rounded bg-[#7B4A2F]"
                style={{ bottom: `${(point.expected / max) * 100}%` }}
              />
            </div>
            <span className="truncate text-[0.68rem] text-muted">{shortDate(point.date)}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-body-sm text-muted">
        Zekerheid: {analytics.forecast.confidence} · {analytics.forecast.trainingDays} volledige meetdagen. {analytics.forecast.reason}
      </p>
      <p className="sr-only">Verwachte sessies: {points.map((point) => `${shortDate(point.date)} ${point.expected}, bandbreedte ${point.low} tot ${point.high}`).join(", ")}.</p>
    </div>
  );
}

function FunnelChart({ analytics, display }: { analytics: DashboardAnalytics; display: "number" | "chart" }) {
  const rows = [
    { label: "Winkelwagen", value: analytics.funnel.cart, color: "bg-[#7B4A2F]" },
    { label: "Betalen", value: analytics.funnel.checkout, color: "bg-[#DB7B2B]" },
    { label: "Aankoopsignaal", value: analytics.funnel.purchase, color: "bg-[#319369]" },
  ];
  const base = Math.max(analytics.funnel.cart ?? 0, 1);
  return (
    <div className={cn("mt-5", display === "number" && "grid gap-3 sm:grid-cols-3")}>
      {rows.map((row, index) => {
        const width = row.value === null ? 0 : index === 0 ? 100 : Math.round((row.value / base) * 100);
        if (display === "number") {
          return <div key={row.label} className="rounded-card bg-background p-4"><p className="text-body-sm font-semibold">{row.label}</p><p className="mt-1 font-heading text-3xl font-bold">{integer(row.value)}</p></div>;
        }
        return (
          <div key={row.label} className="mb-4 last:mb-0">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-body-sm font-bold text-text">{row.label}</span>
              <strong className="font-mono">{integer(row.value)}</strong>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-4 min-w-0 flex-1 overflow-hidden rounded-full bg-background" aria-hidden="true">
                <div className={cn("h-full rounded-full", row.color)} style={{ width: `${Math.max(row.value === null ? 0 : 2, width)}%` }} />
              </div>
              <span className="w-12 shrink-0 text-right text-xs font-bold text-text">
                {row.value === null ? "—" : index === 0 ? "start" : `${width}%`}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function WidgetTools({
  widget,
  onEdit,
  onDragStart,
  onDragMove,
  onDragEnd,
  inverted,
}: {
  widget: DashboardWidgetConfig;
  onEdit: () => void;
  onDragStart: (id: string) => void;
  onDragMove: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onDragEnd: () => void;
  inverted?: boolean;
}) {
  const buttonClass = cn(
    "inline-flex h-11 w-11 touch-manipulation items-center justify-center rounded-button",
    inverted ? "text-white/80 hover:bg-white/10 hover:text-white" : "text-muted hover:bg-background hover:text-text"
  );
  return (
    <div className={cn("flex items-center justify-between border-b px-2 py-1", inverted ? "border-white/15" : "border-border/70")}>
      <button
        type="button"
        draggable
        className={cn(buttonClass, "cursor-grab touch-none active:cursor-grabbing")}
        aria-label={`${widget.title} verslepen`}
        title="Verslepen"
        onDragStart={() => onDragStart(widget.id)}
        onDragEnd={onDragEnd}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          onDragStart(widget.id);
        }}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
      ><GripVertical className="h-5 w-5" aria-hidden="true" /></button>
      <button type="button" className={buttonClass} onClick={onEdit} aria-label={`${widget.title} instellen`} title="Widget instellen"><Settings2 className="h-5 w-5" aria-hidden="true" /></button>
    </div>
  );
}

export function AdminDashboardWorkspace({ commerce, recentOrders }: Props) {
  const router = useRouter();
  const [preferences, setPreferencesState] = useState<DashboardPreferences>(copyPreferences);
  const [analytics, setAnalytics] = useState<DashboardAnalytics>(EMPTY_DASHBOARD_ANALYTICS);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [preferencesWritable, setPreferencesWritable] = useState(false);
  const [preferencesDirty, setPreferencesDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newSource, setNewSource] = useState<DashboardWidgetSource>("sessions");
  const [addedMessage, setAddedMessage] = useState("");
  const dragIdRef = useRef<string | null>(null);
  const lastDragTargetRef = useRef<string | null>(null);
  const preferenceSaveQueue = useRef<Promise<void>>(Promise.resolve());
  const settingsDialogRef = useRef<HTMLElement | null>(null);
  const editingDialogRef = useRef<HTMLFormElement | null>(null);

  const setPreferences = useCallback((
    update: DashboardPreferences | ((current: DashboardPreferences) => DashboardPreferences)
  ) => {
    if (preferencesReady) setPreferencesDirty(true);
    setPreferencesState(update);
  }, [preferencesReady]);

  const fetchAnalytics = useCallback(async (force = false) => {
    setAnalyticsLoading(true);
    try {
      const response = await fetch(`/api/admin/dashboard/analytics${force ? "?refresh=1" : ""}`, { cache: "no-store" });
      if (!response.ok) throw new Error("ANALYTICS_RESPONSE_FAILED");
      setAnalytics(await response.json() as DashboardAnalytics);
    } catch {
      setAnalytics({ ...EMPTY_DASHBOARD_ANALYTICS, generatedAt: new Date().toISOString() });
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8_000);
    void fetchAnalytics();
    fetch("/api/admin/dashboard/preferences", { cache: "no-store", signal: controller.signal }).then(async (response) => {
      if (!active) return;
      if (response.ok) {
        setPreferencesState(await response.json() as DashboardPreferences);
        setPreferencesWritable(true);
      } else {
        setSaveStatus("error");
      }
      setPreferencesDirty(false);
      setPreferencesReady(true);
    }).catch(() => {
      if (active) {
        setSaveStatus("error");
        setPreferencesReady(true);
      }
    }).finally(() => window.clearTimeout(timeout));
    return () => { active = false; window.clearTimeout(timeout); controller.abort(); };
  }, [fetchAnalytics]);

  useEffect(() => {
    if (!settingsOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = settingsDialogRef.current;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setSettingsOpen(false);
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), select:not([disabled]), input:not([disabled]), textarea:not([disabled]), [href]'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1) ?? first;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = priorOverflow;
      previousFocus?.focus();
    };
  }, [settingsOpen]);

  useEffect(() => {
    if (!editingId) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = editingDialogRef.current;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setEditingId(null);
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled])'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1) ?? first;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = priorOverflow;
      previousFocus?.focus();
    };
  }, [editingId]);

  useEffect(() => {
    if (!preferencesReady || !preferencesWritable || !preferencesDirty) return;
    setSaveStatus("saving");
    const snapshot = preferences;
    const timer = window.setTimeout(() => {
      preferenceSaveQueue.current = preferenceSaveQueue.current
        .catch(() => undefined)
        .then(async () => {
          try {
            const response = await fetch("/api/admin/dashboard/preferences", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(snapshot),
            });
            setSaveStatus(response.ok ? "saved" : "error");
          } catch {
            setSaveStatus("error");
          }
        });
    }, 650);
    return () => window.clearTimeout(timer);
  }, [preferences, preferencesDirty, preferencesReady, preferencesWritable]);

  const visible = useMemo(() => preferences.widgets.filter((widget) => !widget.hidden), [preferences]);
  const hidden = useMemo(() => preferences.widgets.filter((widget) => widget.hidden), [preferences]);
  const editing = preferences.widgets.find((widget) => widget.id === editingId) ?? null;

  const updateWidget = useCallback((id: string, update: Partial<DashboardWidgetConfig>) => {
    setPreferencesDirty(true);
    setPreferences((current) => ({ ...current, widgets: current.widgets.map((widget) => widget.id === id ? { ...widget, ...update } : widget) }));
  }, []);

  const moveWidgetTo = useCallback((sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    setPreferencesDirty(true);
    setPreferences((current) => {
      const widgets = [...current.widgets];
      const sourceIndex = widgets.findIndex((widget) => widget.id === sourceId);
      const targetIndex = widgets.findIndex((widget) => widget.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return current;
      const [source] = widgets.splice(sourceIndex, 1);
      widgets.splice(targetIndex, 0, source);
      return { ...current, widgets };
    });
  }, []);

  function moveVisible(id: string, direction: -1 | 1) {
    const index = visible.findIndex((widget) => widget.id === id);
    const target = visible[index + direction];
    if (target) moveWidgetTo(id, target.id);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    if (!dragIdRef.current || event.buttons === 0) return;
    const edge = Math.min(72, window.innerHeight * 0.18);
    if (event.clientY < edge) window.scrollBy({ top: -18, behavior: "auto" });
    else if (event.clientY > window.innerHeight - edge) window.scrollBy({ top: 18, behavior: "auto" });
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-widget-id]");
    if (target?.dataset.widgetId && target.dataset.widgetId !== lastDragTargetRef.current) {
      lastDragTargetRef.current = target.dataset.widgetId;
      moveWidgetTo(dragIdRef.current, target.dataset.widgetId);
    }
  }

  function refreshWidget(source: DashboardWidgetSource) {
    if (analyticsSources.has(source)) void fetchAnalytics(true);
    else router.refresh();
  }

  function addWidget() {
    const label = DASHBOARD_WIDGET_SOURCES.find((item) => item.source === newSource)?.label ?? "Nieuwe widget";
    setPreferencesDirty(true);
    setPreferences((current) => ({
      ...current,
      widgets: [...current.widgets, {
        id: `custom-${Date.now().toString(36)}`,
        source: newSource,
        title: label,
        text: "",
        display: chartCapableSources.has(newSource) ? "chart" : "number",
        hidden: false,
        custom: true,
      }],
    }));
    setAddedMessage(`${label} is toegevoegd.`);
  }

  const metricValue = (source: DashboardWidgetSource) => {
    switch (source) {
      case "activeVisitors": return integer(analytics.metrics.activeVisitors);
      case "revenueToday": return euro(analytics.metrics.revenueToday);
      case "sessions": return integer(analytics.metrics.sessions);
      case "views": return integer(analytics.metrics.views);
      case "engagement": return percent(analytics.metrics.engagement);
      case "keyEvents": return integer(analytics.metrics.keyEvents);
      case "activeProducts": return integer(commerce.activeProducts);
      case "categories": return integer(commerce.categories);
      case "totalOrders": return integer(commerce.totalOrders);
      case "pendingOrders": return integer(commerce.pendingOrders);
      default: return "—";
    }
  };

  const metricSeries = (source: DashboardWidgetSource) => {
    if (source === "revenueToday") return analytics.daily.map((point) => point.revenue);
    if (source === "sessions") return analytics.daily.map((point) => point.sessions);
    return [];
  };

  const widgetHref: Partial<Record<DashboardWidgetSource, string>> = {
    activeProducts: "/admin/producten",
    categories: "/admin/categorieen",
    totalOrders: "/admin/bestellingen",
    pendingOrders: "/admin/bestellingen?status=PENDING",
  };

  function renderWidget(widget: DashboardWidgetConfig) {
    if (!wideSources.has(widget.source)) {
      const display = chartCapableSources.has(widget.source) ? widget.display : "number";
      const body = <MetricContent value={metricValue(widget.source)} display={display} series={metricSeries(widget.source)} label={widget.title} hero={heroSources.has(widget.source)} />;
      const href = widgetHref[widget.source];
      return href ? <Link href={href} className="block rounded-button focus-visible:outline-offset-4">{body}</Link> : body;
    }
    if (widget.source === "recentOrders") {
      if (!recentOrders.length) return <p className="mt-4 text-body-sm text-muted">Nog geen bestellingen.</p>;
      return (
        <div className="mt-4">
          <div className="grid gap-3 md:hidden">
            {recentOrders.map((order) => (
              <article key={order.id} className="rounded-card border border-border bg-background p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/admin/bestellingen/${order.id}`} className="inline-flex min-h-11 items-center font-mono text-body-sm font-semibold text-[#684027] underline underline-offset-4">
                      {order.id.slice(0, 10)}…
                    </Link>
                    <p className="mt-1 truncate text-body-sm font-semibold">{order.contactName}</p>
                  </div>
                  <strong className="shrink-0 text-body-sm">{order.total}</strong>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted">
                  <span>{orderStatusLabels[order.status] ?? order.status}</span>
                  <time dateTime={order.createdAt}>
                    {new Intl.DateTimeFormat("nl-NL", { dateStyle: "short", timeStyle: "short" }).format(new Date(order.createdAt))}
                  </time>
                </div>
              </article>
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[42rem] text-body-sm">
              <thead><tr className="border-b border-border text-left text-muted"><th className="px-3 py-3">Bestelnummer</th><th className="px-3 py-3">Klant</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Datum</th><th className="px-3 py-3 text-right">Totaal</th></tr></thead>
              <tbody>{recentOrders.map((order) => <tr key={order.id} className="border-b border-border last:border-0"><td className="px-3 py-3"><Link href={`/admin/bestellingen/${order.id}`} className="inline-flex min-h-11 items-center font-mono font-semibold text-[#684027] underline underline-offset-4">{order.id.slice(0, 10)}…</Link></td><td className="px-3 py-3">{order.contactName}</td><td className="px-3 py-3">{orderStatusLabels[order.status] ?? order.status}</td><td className="px-3 py-3 text-muted">{new Intl.DateTimeFormat("nl-NL", { dateStyle: "short", timeStyle: "short" }).format(new Date(order.createdAt))}</td><td className="px-3 py-3 text-right font-semibold">{order.total}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="mt-4 text-right"><Link href="/admin/bestellingen" className="inline-flex min-h-11 items-center font-heading text-body-sm font-semibold text-[#684027] underline underline-offset-4">Alle bestellingen</Link></div>
        </div>
      );
    }
    if (widget.source === "forecast") {
      return widget.display === "chart" ? <ForecastChart analytics={analytics} /> : <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{analytics.forecast.points.map((point) => <div key={point.date} className="rounded-card bg-background p-3"><p className="text-xs text-muted">{shortDate(point.date)}</p><p className="mt-1 font-heading text-2xl font-bold">{point.expected}</p><p className="text-xs text-muted">{point.low}–{point.high}</p></div>)}</div>;
    }
    if (widget.source === "dailyRevenue") {
      const shown = analytics.daily.slice(-30);
      return widget.display === "chart" ? <DailyRevenueChart points={shown} /> : <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{shown.slice(-8).map((point) => <div key={point.date} className="rounded-card bg-background p-3"><p className="text-xs text-muted">{shortDate(point.date)}</p><p className="mt-1 font-heading text-xl font-bold">{euro(point.revenue)}</p></div>)}</div>;
    }
    if (widget.source === "funnel") return <FunnelChart analytics={analytics} display={widget.display} />;
    if (widget.source === "improvementSignals") {
      const signals = [
        { label: "Kritiek", text: "eerst oplossen", value: analytics.signals.critical, border: "border-l-[#D34B35]" },
        { label: "Hoog", text: "deze sprint", value: analytics.signals.high, border: "border-l-[#DB7B2B]" },
        { label: "Sterk signaal", text: "verder uitbouwen", value: analytics.signals.positive, border: "border-l-[#319369]" },
      ];
      return <div className="mt-5 grid gap-3 lg:grid-cols-3">{signals.map((signal) => <div key={signal.label} className={cn("rounded-card border border-border border-l-4 bg-surface p-5", signal.border)}><div className="flex items-start justify-between gap-3"><div><p className="font-heading text-xs font-bold uppercase tracking-wider">{signal.label}</p><p className="mt-1 text-body-sm text-muted">{signal.text}</p></div><strong className="font-mono text-3xl">{signal.value}</strong></div></div>)}</div>;
    }
    if (widget.source === "improvements") {
      if (!analytics.issues.length) return <p className="mt-4 text-body-sm text-muted">Zodra voldoende live data beschikbaar is verschijnen hier concrete verbeterpunten.</p>;
      return <div className="mt-5 grid gap-4 lg:grid-cols-2">{analytics.issues.map((issue) => <article key={issue.id} className={cn("rounded-card border border-border bg-background p-5", issue.severity === "critical" && "border-l-4 border-l-[#D34B35]", issue.severity === "high" && "border-l-4 border-l-[#DB7B2B]", issue.severity === "positive" && "border-l-4 border-l-[#319369]")}><p className="text-xs font-bold uppercase tracking-wider text-muted">{issue.severity === "positive" ? "Sterk signaal" : issue.severity}</p><h3 className="mt-2 font-heading text-heading-sm font-bold">{issue.title}</h3><p className="mt-2 text-body-sm text-muted">{issue.evidence}</p><p className="mt-3 text-body-sm font-semibold text-text">{issue.action}</p></article>)}</div>;
    }
    return null;
  }

  if (!preferencesReady) {
    return (
      <div aria-busy="true" aria-label="Dashboardindeling laden">
        <div className="h-20 animate-pulse rounded-panel bg-surface" />
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="col-span-2 h-44 animate-pulse rounded-panel bg-surface lg:col-span-1" />
          <div className="col-span-2 h-44 animate-pulse rounded-panel bg-surface lg:col-span-1" />
          {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-36 animate-pulse rounded-panel bg-surface" />)}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><h1 className="text-heading-xl text-text">Dashboard</h1><p className="mt-1 text-body-sm text-muted">Live inzicht en webshopbeheer in één aanpasbare werkruimte.</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <span role="status" aria-live="polite" className={cn("text-xs", saveStatus === "error" ? "text-red-700" : "text-muted")}>{saveStatus === "saving" ? "Indeling opslaan…" : saveStatus === "saved" ? "Indeling opgeslagen" : saveStatus === "error" ? "Opslaan mislukt" : ""}</span>
          <button type="button" onClick={() => { router.refresh(); void fetchAnalytics(true); }} className="inline-flex min-h-11 items-center gap-2 rounded-button border border-border bg-surface px-4 font-heading text-body-sm font-semibold hover:border-border-hover"><RefreshCw className={cn("h-4 w-4", analyticsLoading && "animate-spin")} aria-hidden="true" />Vernieuwen</button>
          <button type="button" onClick={() => { setAddedMessage(""); setSettingsOpen(true); }} className="inline-flex min-h-11 items-center gap-2 rounded-button bg-accent px-4 font-heading text-body-sm font-semibold text-contrast shadow-button hover:bg-accent-hover"><Settings2 className="h-4 w-4" aria-hidden="true" />Widgets aanpassen</button>
        </div>
      </div>

      <div className={cn("mt-5 flex items-center justify-between gap-3 rounded-card border px-4 py-3 text-body-sm", analytics.status === "unavailable" ? "border-[#D9B7AF] bg-[#FFF5F2]" : "border-border bg-surface")} role="status">
        <span>{analyticsLoading ? "GA4-gegevens vernieuwen…" : analytics.message}</span>
        {!analyticsLoading && analytics.generatedAt !== EMPTY_DASHBOARD_ANALYTICS.generatedAt ? <time className="shrink-0 text-xs text-muted" dateTime={analytics.generatedAt}>{new Intl.DateTimeFormat("nl-NL", { hour: "2-digit", minute: "2-digit" }).format(new Date(analytics.generatedAt))}</time> : null}
      </div>

      <div className="mt-6 grid grid-cols-12 gap-4">
        {visible.map((widget) => (
          <section
            key={widget.id}
            data-widget-id={widget.id}
            onDragOver={(event) => {
              event.preventDefault();
              if (dragIdRef.current && lastDragTargetRef.current !== widget.id) {
                lastDragTargetRef.current = widget.id;
                moveWidgetTo(dragIdRef.current, widget.id);
              }
            }}
            className={cn(
              "overflow-hidden rounded-panel border border-border bg-surface shadow-card transition-shadow hover:shadow-card-hover",
              wideSources.has(widget.source) ? "col-span-12" : heroSources.has(widget.source) ? "col-span-12 lg:col-span-6" : "col-span-6 lg:col-span-3",
              widget.source === "revenueToday" && "border-[#7B4A2F] bg-[#7B4A2F] text-white",
              widget.source === "activeVisitors" && "border-accent bg-[#FFF8DD]"
            )}
          >
            <WidgetTools
              widget={widget}
              onEdit={() => setEditingId(widget.id)}
              onDragStart={(id) => { dragIdRef.current = id; lastDragTargetRef.current = null; }}
              onDragMove={handlePointerMove}
              onDragEnd={() => { dragIdRef.current = null; lastDragTargetRef.current = null; }}
              inverted={widget.source === "revenueToday"}
            />
            <div className={cn("p-4 sm:p-5", wideSources.has(widget.source) && "sm:p-6")}>
              <p className={cn("font-heading text-xs font-bold uppercase tracking-[0.12em]", widget.source === "revenueToday" ? "text-white/75" : "text-muted")}>{widget.title}</p>
              {widget.text ? <p className={cn("mt-1 text-xs", widget.source === "revenueToday" ? "text-white/70" : "text-muted")}>{widget.text}</p> : null}
              {renderWidget(widget)}
            </div>
          </section>
        ))}
      </div>

      {settingsOpen ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-contrast/45">
          <button type="button" className="absolute inset-0" aria-label="Widgetinstellingen sluiten" onClick={() => setSettingsOpen(false)} />
          <aside
            ref={settingsDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="widget-settings-title"
            className="relative z-10 h-full w-full max-w-lg overscroll-contain overflow-y-auto bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] shadow-card-hover sm:p-7"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 id="widget-settings-title" className="font-heading text-heading-md font-bold">Widgets aanpassen</h2>
                <p className="mt-1 text-body-sm text-muted">Sleep kaarten of gebruik de pijlen. Wijzigingen worden per beheerder opgeslagen.</p>
              </div>
              <button data-autofocus type="button" onClick={() => setSettingsOpen(false)} className="inline-flex h-11 w-11 items-center justify-center rounded-button hover:bg-background" aria-label="Sluiten"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-6 rounded-card border border-border bg-background p-4">
              <label htmlFor="new-widget-source" className="text-body-sm font-semibold">Nieuwe widget</label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <select id="new-widget-source" value={newSource} onChange={(event) => setNewSource(event.target.value as DashboardWidgetSource)} className="min-h-11 flex-1 rounded-button border border-border bg-surface px-3">
                  {DASHBOARD_WIDGET_SOURCES.map((item) => <option key={item.source} value={item.source}>{item.label}</option>)}
                </select>
                <button type="button" onClick={addWidget} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-button bg-accent px-4 font-heading font-semibold"><Plus className="h-4 w-4" />Toevoegen</button>
              </div>
              <p role="status" aria-live="polite" className="mt-2 min-h-5 text-body-sm font-semibold text-[#684027]">{addedMessage}</p>
            </div>
            <div className="mt-6">
              <h3 className="font-heading text-heading-sm font-bold">Verborgen widgets</h3>
              {hidden.length ? (
                <div className="mt-3 grid gap-2">
                  {hidden.map((widget) => <div key={widget.id} className="flex min-h-12 items-center justify-between gap-3 rounded-card border border-border px-3"><span className="min-w-0 truncate text-body-sm font-semibold">{widget.title}</span><div className="flex"><button type="button" onClick={() => updateWidget(widget.id, { hidden: false })} className="min-h-11 px-3 text-body-sm font-semibold text-[#684027] underline underline-offset-4">Terugzetten</button>{widget.custom ? <button type="button" onClick={() => setPreferences((current) => ({ ...current, widgets: current.widgets.filter((item) => item.id !== widget.id) }))} className="inline-flex h-11 w-11 items-center justify-center text-red-700" aria-label={`${widget.title} definitief verwijderen`}><Trash2 className="h-4 w-4" /></button> : null}</div></div>)}
                </div>
              ) : <p className="mt-2 text-body-sm text-muted">Geen verborgen widgets.</p>}
            </div>
            <button type="button" onClick={() => setPreferences(copyPreferences())} className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-button border border-border px-4 font-heading text-body-sm font-semibold hover:bg-background"><RotateCcw className="h-4 w-4" />Standaardindeling herstellen</button>
          </aside>
        </div>
      ) : null}

      {editing ? (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-contrast/45 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
          <button type="button" className="absolute inset-0" aria-label="Bewerken sluiten" onClick={() => setEditingId(null)} />
          <form
            ref={editingDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-widget-title"
            className="relative z-10 max-h-[calc(100dvh-2rem)] w-full max-w-lg overscroll-contain overflow-y-auto rounded-panel bg-surface p-6 shadow-card-hover"
            onSubmit={(event) => { event.preventDefault(); setEditingId(null); }}
          >
            <div className="flex items-center justify-between">
              <h2 id="edit-widget-title" className="font-heading text-heading-md font-bold">Widget bewerken</h2>
              <button data-autofocus type="button" onClick={() => setEditingId(null)} className="inline-flex h-11 w-11 items-center justify-center rounded-button hover:bg-background" aria-label="Sluiten"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" disabled={visible.findIndex((widget) => widget.id === editing.id) === 0} onClick={() => moveVisible(editing.id, -1)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-button border border-border font-heading text-body-sm font-semibold disabled:opacity-40"><ChevronUp className="h-4 w-4" />Omhoog</button>
              <button type="button" disabled={visible.findIndex((widget) => widget.id === editing.id) === visible.length - 1} onClick={() => moveVisible(editing.id, 1)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-button border border-border font-heading text-body-sm font-semibold disabled:opacity-40"><ChevronDown className="h-4 w-4" />Omlaag</button>
            </div>
            <label className="mt-5 block text-body-sm font-semibold" htmlFor="widget-title">Titel</label>
            <input id="widget-title" value={editing.title} maxLength={80} onChange={(event) => updateWidget(editing.id, { title: event.target.value })} className="mt-1 min-h-11 w-full rounded-button border border-border px-3" />
            <label className="mt-4 block text-body-sm font-semibold" htmlFor="widget-text">Tekst <span className="font-normal text-muted">(leeg laten om te verwijderen)</span></label>
            <textarea id="widget-text" value={editing.text} maxLength={240} rows={4} onChange={(event) => updateWidget(editing.id, { text: event.target.value })} className="mt-1 w-full rounded-button border border-border px-3 py-2" />
            {chartCapableSources.has(editing.source) ? (
              <fieldset className="mt-4">
                <legend className="text-body-sm font-semibold">Weergave</legend>
                <div className="mt-2 grid grid-cols-2 gap-2">{(["number", "chart"] as const).map((display) => <label key={display} className={cn("flex min-h-11 cursor-pointer items-center gap-2 rounded-button border px-3", editing.display === display ? "border-accent bg-[#FFF8DD]" : "border-border")}><input type="radio" name="display" checked={editing.display === display} onChange={() => updateWidget(editing.id, { display })} />{display === "number" ? "Cijfers" : "Grafiek"}</label>)}</div>
              </fieldset>
            ) : null}
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => refreshWidget(editing.source)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-button border border-border font-heading text-body-sm font-semibold"><RefreshCw className="h-4 w-4" />Vernieuwen</button>
              <button type="button" onClick={() => { updateWidget(editing.id, { hidden: true }); setEditingId(null); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-button border border-red-200 font-heading text-body-sm font-semibold text-red-700"><Trash2 className="h-4 w-4" />Verwijderen</button>
            </div>
            <button type="submit" className="mt-4 min-h-11 w-full rounded-button bg-accent px-5 font-heading font-semibold shadow-button hover:bg-accent-hover">Gereed</button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
