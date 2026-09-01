"use client";

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Code2,
  Database,
  Download,
  ExternalLink,
  FileJson,
  HelpCircle,
  Info,
  Mail,
  Play,
  Printer,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Store,
  X,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type {
  PriceMonitorApexLocalRunView,
  PriceMonitorApexLocalSession,
  PriceMonitorApexScanPage,
  PriceMonitorApexScanSummary,
  PriceMonitorApexScriptInfo,
  PriceMonitorApexRunResult,
  PriceMonitorComparisonView,
  PriceMonitorDashboard,
} from "@/lib/price-monitor/types";

type Tab = "overview" | "scan" | "compare" | "actions" | "reports" | "help";

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Overzicht" },
  { id: "scan", label: "Scraperresultaat" },
  { id: "compare", label: "Vergelijken" },
  { id: "actions", label: "Acties" },
  { id: "reports", label: "Rapporten" },
  { id: "help", label: "Uitleg" },
];

const onboarding = [
  ["Kies de webshop", "Kies welke notenwebshop APEX in deze proefronde moet bekijken."],
  ["Download de scraper", "Download het gecontroleerde apex.py-bestand. Hier zijn geen abonnementen of API-sleutels voor nodig."],
  ["Voer hem lokaal uit", "Plak de getoonde opdracht in PowerShell. We beginnen bewust met maximaal 25 producten."],
  ["Laat het resultaat inladen", "APEX stuurt het resultaat na afloop automatisch en beveiligd terug naar deze prijsmonitor."],
  ["Wij maken prijzen vergelijkbaar", "Een zak van 250 gram en een zak van 1 kilo rekenen we om naar dezelfde prijs per kilo."],
  ["Controleer wat niet duidelijk is", "Zijn product of gewicht niet zeker? Dan vragen we jou eerst om de koppeling goed te keuren."],
  ["Bekijk opvallende verschillen", "Je ziet waar wij duidelijk duurder of goedkoper zijn, inclusief bron en meetmoment."],
  ["Bekijk het prijsvoorstel", "De Prijscoach maakt een voorzichtige conceptsuggestie. Er verandert nog niets."],
  ["Pas aan en bevestig", "Je mag het bedrag aanpassen. Alleen na jouw margecontrole en bevestiging wordt de prijs gewijzigd."],
] as const;

export function PriceMonitorWorkspace({
  initialDashboard,
  initialApexScan,
  initialApexScript,
  canWrite,
}: {
  initialDashboard: PriceMonitorDashboard;
  initialApexScan: PriceMonitorApexScanSummary;
  initialApexScript: PriceMonitorApexScriptInfo;
  canWrite: boolean;
}) {
  const [dashboard, setDashboard] = useState(initialDashboard);
  const [tab, setTab] = useState<Tab>("overview");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [onboardingOpen, setOnboardingOpen] = useState(
    dashboard.summary.productsObserved === 0
  );
  const [query, setQuery] = useState("");
  const [onlySignificant, setOnlySignificant] = useState(false);
  const [onlyReview, setOnlyReview] = useState(false);
  const [actionItem, setActionItem] = useState<PriceMonitorComparisonView | null>(null);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/admin/price-monitor", { cache: "no-store" });
    if (!response.ok) throw new Error(await responseError(response));
    const nextDashboard = (await response.json()) as PriceMonitorDashboard;
    setDashboard(nextDashboard);
    return nextDashboard;
  }, []);

  const reviewMatch = async (matchId: string, decision: "APPROVE" | "REJECT") => {
    setBusy(`match:${matchId}`);
    setError(null);
    try {
      const response = await fetch(`/api/admin/price-monitor/matches/${matchId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      await refresh();
      setNotice(
        decision === "APPROVE"
          ? "Productkoppeling goedgekeurd. De Prijscoach heeft het voorstel opnieuw bekeken."
          : "Productkoppeling genegeerd. Deze vergelijking telt niet meer mee."
      );
    } catch (cause) {
      setError(messageForError(cause));
    } finally {
      setBusy(null);
    }
  };

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("nl-NL");
    return dashboard.comparisons.filter((item) => {
      if (
        normalizedQuery &&
        !`${item.ownProduct} ${item.ownSku} ${item.competitor} ${item.competitorProduct}`
          .toLocaleLowerCase("nl-NL")
          .includes(normalizedQuery)
      ) return false;
      if (onlySignificant && Math.abs(item.differenceBps) < 800) return false;
      if (onlyReview && item.matchStatus !== "SUGGESTED") return false;
      return true;
    });
  }, [dashboard.comparisons, onlyReview, onlySignificant, query]);

  const openActions = dashboard.comparisons.filter(
    (item) => isActionableRecommendation(item)
  );
  const openSources = () => {
    setTab("overview");
    window.setTimeout(() => {
      document.getElementById("bronnen")?.scrollIntoView({ behavior: "smooth" });
    }, 0);
  };

  return (
    <div className="price-monitor-workspace min-w-0 space-y-6 pb-12">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-heading text-xs font-bold uppercase tracking-[0.14em] text-accent-ink">
            Groei & marktinzicht
          </p>
          <h1 className="mt-1 font-heading text-[clamp(2rem,9vw,2.75rem)] font-bold leading-none text-text">
            Prijsmonitor
          </h1>
          <p className="mt-2 max-w-3xl text-body-sm leading-relaxed text-muted">
            Vergelijk onze prijzen met andere notenwebshops en bepaal rustig wat je wilt aanpassen.
          </p>
          <p className="mt-2 text-xs font-semibold text-muted">
            {freshnessLabel(dashboard)}
          </p>
        </div>
        <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-2">
          <button
            type="button"
            onClick={openSources}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-button bg-accent px-5 font-heading font-bold text-contrast shadow-card transition hover:bg-accent-hover focus-visible:outline-none"
          >
            <Play className="h-5 w-5" aria-hidden="true" /> Nieuwe prijsronde
          </button>
          <button
            type="button"
            onClick={() => { setTab("help"); setOnboardingOpen(true); }}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-button border border-border bg-surface px-5 font-heading font-bold text-text transition hover:border-border-hover hover:bg-background focus-visible:outline-none"
          >
            <HelpCircle className="h-5 w-5" aria-hidden="true" /> Hoe werkt dit?
          </button>
        </div>
      </header>

      {dashboard.setupRequired ? (
        <div role="alert" className="rounded-panel border border-amber-300 bg-amber-50 p-4 text-amber-950 sm:p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-heading font-bold">Database-update staat nog klaar</p>
              <p className="mt-1 text-body-sm leading-relaxed">
                Het scherm is gebouwd, maar de nieuwe prijstabellen zijn nog niet geactiveerd. Daarom kun je veilig rondkijken, maar nog geen prijsronde starten of rapportplanning opslaan.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {notice ? (
        <div role="status" aria-live="polite" className="flex items-start gap-3 rounded-panel border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p className="text-body-sm font-semibold">{notice}</p>
        </div>
      ) : null}
      {error ? (
        <div role="alert" className="flex items-start justify-between gap-3 rounded-panel border border-red-200 bg-red-50 p-4 text-red-950">
          <div className="flex items-start gap-3">
            <XCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <p className="text-body-sm font-semibold">{error}</p>
          </div>
          <button type="button" onClick={() => setError(null)} className="min-h-11 min-w-11 rounded-button" aria-label="Foutmelding sluiten">
            <X className="mx-auto h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      ) : null}
      {!canWrite ? (
        <div className="rounded-panel border border-amber-300 bg-amber-50 p-4 text-body-sm font-semibold text-amber-950">
          Je kunt dit overzicht bekijken en exporteren. Alleen een beheerder met productrechten kan prijsrondes, koppelingen, rapportinstellingen en prijsacties aanpassen.
        </div>
      ) : null}

      <nav aria-label="Onderdelen prijsmonitor" className="grid grid-cols-2 gap-2 rounded-panel border border-border bg-surface p-2 shadow-card sm:grid-cols-3 xl:grid-cols-6">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-current={tab === item.id ? "page" : undefined}
            onClick={() => setTab(item.id)}
            className={cn(
              "min-h-12 rounded-button px-3 py-2 font-heading text-body-sm font-bold transition focus-visible:outline-none",
              tab === item.id ? "bg-contrast text-white" : "text-text hover:bg-background"
            )}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {(tab === "overview" || tab === "help") ? (
        <Onboarding open={onboardingOpen || tab === "help"} onToggle={() => setOnboardingOpen((value) => !value)} />
      ) : null}

      {tab === "overview" ? (
        <Overview
          dashboard={dashboard}
          apexScan={initialApexScan}
          apexScript={initialApexScript}
          canWrite={canWrite}
          onNotice={setNotice}
          onError={setError}
          onImported={refresh}
          onOpenComparisons={() => setTab("compare")}
          onOpenActions={() => setTab("actions")}
          onOpenApexScan={() => setTab("scan")}
        />
      ) : null}

      {tab === "scan" ? (
        <ApexScanSection summary={initialApexScan} />
      ) : null}

      {tab === "compare" ? (
        <ComparisonSection
          comparisons={filtered}
          total={dashboard.comparisons.length}
          query={query}
          onlySignificant={onlySignificant}
          onlyReview={onlyReview}
          busy={canWrite ? busy : "permission"}
          onQuery={setQuery}
          onOnlySignificant={setOnlySignificant}
          onOnlyReview={setOnlyReview}
          onReview={reviewMatch}
          onAction={setActionItem}
        />
      ) : null}

      {tab === "actions" ? (
        <ActionsSection
          items={openActions}
          reviewCount={dashboard.summary.matchesToReview}
          disabled={!canWrite}
          onOpenAction={setActionItem}
          onOpenReview={() => setTab("compare")}
        />
      ) : null}

      {tab === "reports" ? (
        <ReportsSection
          dashboard={dashboard}
          disabled={dashboard.setupRequired || !canWrite}
          onSaved={async () => { await refresh(); setNotice("Rapportinstellingen opgeslagen."); }}
          onError={(message) => setError(message)}
        />
      ) : null}

      {tab === "help" ? <HelpSection /> : null}

      <PriceMonitorSafetyFooter summary={initialApexScan} />

      {actionItem ? (
        <PriceActionDialog
          item={actionItem}
          onClose={() => setActionItem(null)}
          onApplied={async (frontendSynced) => {
            setActionItem(null);
            await refresh();
            setNotice("Prijs veilig aangepast en vastgelegd in het adminlogboek.");
            if (!frontendSynced) {
              setError("Let op: de prijs is opgeslagen, maar de webshopcache kon niet worden ververst. Controleer de productpagina en laat de cache opnieuw verversen.");
            }
          }}
          onError={(message) => setError(message)}
        />
      ) : null}
      <PriceMonitorPrint dashboard={dashboard} />
    </div>
  );
}

function Onboarding({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <section aria-labelledby="onboarding-title" className="rounded-panel border border-border bg-surface shadow-card">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex min-h-14 w-full items-center justify-between gap-4 px-4 py-3 text-left sm:px-6"
      >
        <span>
          <span id="onboarding-title" className="block font-heading text-lg font-bold text-text">Zo werkt de prijsmonitor</span>
          <span className="block text-xs text-muted">Negen eenvoudige stappen van bron tot gecontroleerde actie</span>
        </span>
        <ChevronDown className={cn("h-5 w-5 shrink-0 transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>
      {open ? (
        <ol className="grid gap-3 border-t border-border p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-4">
          {onboarding.map(([title, description], index) => (
            <li key={title} className="rounded-card border border-border bg-background p-4">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-accent font-heading text-sm font-bold text-contrast">{index + 1}</span>
              <h3 className="mt-3 font-heading font-bold text-text">{title}</h3>
              <p className="mt-1 text-body-sm leading-relaxed text-muted">{description}</p>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}

function Overview({
  dashboard,
  apexScan,
  apexScript,
  canWrite,
  onNotice,
  onError,
  onImported,
  onOpenComparisons,
  onOpenActions,
  onOpenApexScan,
}: {
  dashboard: PriceMonitorDashboard;
  apexScan: PriceMonitorApexScanSummary;
  apexScript: PriceMonitorApexScriptInfo;
  canWrite: boolean;
  onNotice: (message: string | null) => void;
  onError: (message: string | null) => void;
  onImported: () => Promise<PriceMonitorDashboard>;
  onOpenComparisons: () => void;
  onOpenActions: () => void;
  onOpenApexScan: () => void;
}) {
  const cards = [
    ["Producten gezien", dashboard.summary.productsObserved, Store],
    ["Even controleren", dashboard.summary.matchesToReview, ShieldCheck],
    ["Opvallende verschillen", dashboard.summary.significantDifferences, BarChart3],
    ["Conceptacties", dashboard.summary.openActions, Sparkles],
  ] as const;
  const largest = [...dashboard.comparisons]
    .filter((item) => item.safeForAnalysis)
    .sort((a, b) => Math.abs(b.differenceBps) - Math.abs(a.differenceBps))
    .slice(0, 5);
  return (
    <div className="space-y-6">
      <section className="rounded-panel border border-accent bg-amber-50 p-5 text-amber-950 shadow-card sm:p-6" aria-labelledby="apex-import-title">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <Database className="mt-0.5 h-6 w-6 shrink-0 text-accent-ink" aria-hidden="true" />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-amber-800">Alleen-lezen import</p>
              <h2 id="apex-import-title" className="mt-1 font-heading text-xl font-bold">Eerste APEX-scan ingelezen</h2>
              <p className="mt-1 text-body-sm leading-relaxed">
                {apexScan.productCount.toLocaleString("nl-NL")} producten en {apexScan.priceRowCount.toLocaleString("nl-NL")} prijsregels uit {apexScan.sourcesWithResults} webshops staan klaar om te bekijken. Er is geen live prijs aangepast.
              </p>
            </div>
          </div>
          <button type="button" onClick={onOpenApexScan} className="min-h-12 shrink-0 rounded-button bg-contrast px-5 font-heading font-bold text-white">
            Bekijk scraperresultaat
          </button>
        </div>
      </section>

      <section aria-label="Samenvatting" className="grid grid-cols-12 gap-3 sm:gap-4">
        {cards.map(([label, value, Icon]) => (
          <article key={label} className="col-span-6 min-w-0 rounded-panel border border-border bg-surface p-4 shadow-card lg:col-span-3 sm:p-5">
            <Icon className="h-5 w-5 text-accent-ink" aria-hidden="true" />
            <p className="mt-3 font-heading text-3xl font-bold tabular-nums text-text">{value}</p>
            <p className="mt-1 text-xs font-semibold text-muted">{label}</p>
          </article>
        ))}
        <article className="col-span-12 rounded-panel border border-border bg-contrast p-5 text-white shadow-card lg:col-span-5 sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/65">Datakwaliteit</p>
          <p className="mt-2 font-heading text-4xl font-bold tabular-nums">
            {dashboard.summary.averageDataQualityScore === null ? "—" : `${dashboard.summary.averageDataQualityScore}%`}
          </p>
          <p className="mt-2 text-body-sm leading-relaxed text-white/75">
            Dit cijfer kijkt naar prijs, gewicht, valuta, productinformatie en uitschieters. Aantallen en waarschuwingen blijven altijd belangrijker dan alleen de score.
          </p>
          <button type="button" onClick={onOpenComparisons} className="mt-4 min-h-12 rounded-button bg-white px-4 font-heading font-bold text-contrast">
            Controleer de gegevens
          </button>
        </article>
        <article className="col-span-12 rounded-panel border border-border bg-surface p-5 shadow-card lg:col-span-7 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-heading text-xl font-bold text-text">Grootste prijsverschillen</h2>
              <p className="text-body-sm text-muted">Positief betekent dat wij duurder zijn dan de vergelijkbare verpakking.</p>
            </div>
            <button type="button" onClick={onOpenComparisons} className="min-h-11 rounded-button border border-border px-3 font-heading text-sm font-bold">Alles</button>
          </div>
          {largest.length ? (
            <div className="mt-5 space-y-4">
              {largest.map((item) => {
                const width = Math.min(100, Math.max(8, Math.abs(item.differenceBps) / 30));
                return (
                  <div key={item.matchId}>
                    <div className="flex items-end justify-between gap-3 text-body-sm">
                      <span className="min-w-0 truncate font-semibold text-text">{item.ownProduct}</span>
                      <span className={cn("shrink-0 font-bold tabular-nums", item.differenceBps > 0 ? "text-red-700" : "text-emerald-700")}>
                        {signedPercent(item.differenceBps)}
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-background" aria-hidden="true">
                      <div className={cn("h-full rounded-full", item.differenceBps > 0 ? "bg-red-600" : "bg-emerald-600")} style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <EmptySmall text="Na de eerste goedgekeurde productkoppelingen verschijnen hier de grootste verschillen." />}
        </article>
      </section>

      <ApexRunnerPanel
        summary={apexScan}
        script={apexScript}
        canRun={canWrite && !dashboard.setupRequired}
        onNotice={onNotice}
        onError={onError}
        onImported={onImported}
      />

      <section className="rounded-panel border border-border bg-surface p-5 shadow-card sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-heading text-xl font-bold text-text">Acties blijven onder jouw controle</h2>
            <p className="mt-1 max-w-3xl text-body-sm leading-relaxed text-muted">De Prijscoach maakt alleen voorstellen na een goedgekeurde productmatch. Uitvoeren kan pas na een actuele prijscontrole en jouw margebevestiging.</p>
          </div>
          <button type="button" onClick={onOpenActions} className="min-h-12 shrink-0 rounded-button bg-contrast px-5 font-heading font-bold text-white">Bekijk conceptacties</button>
        </div>
      </section>
    </div>
  );
}

function ApexRunnerPanel({
  summary,
  script,
  canRun,
  onNotice,
  onError,
  onImported,
}: {
  summary: PriceMonitorApexScanSummary;
  script: PriceMonitorApexScriptInfo;
  canRun: boolean;
  onNotice: (message: string | null) => void;
  onError: (message: string | null) => void;
  onImported: () => Promise<PriceMonitorDashboard>;
}) {
  const domains = useMemo(
    () => [...summary.sources]
      .filter((source) => source.domain.includes("."))
      .sort((a, b) => b.productCount - a.productCount || a.domain.localeCompare(b.domain)),
    [summary.sources]
  );
  const [domain, setDomain] = useState(domains[0]?.domain || "");
  const [limit, setLimit] = useState(25);
  const [result, setResult] = useState<PriceMonitorApexRunResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [runCommand, setRunCommand] = useState(
    `py -3 apex.py --domain ${domain} --limit ${limit} --max-pages 40`
  );

  useEffect(() => {
    if (!activeRunId) return;
    let stopped = false;
    let timer: number | null = null;

    const poll = async () => {
      try {
        const response = await fetch(
          `/api/admin/price-monitor/apex-local?runId=${encodeURIComponent(activeRunId)}`,
          { cache: "no-store" }
        );
        if (!response.ok) throw new Error(await responseError(response));
        const view = (await response.json()) as PriceMonitorApexLocalRunView;
        if (stopped) return;
        if (view.status === "RUNNING") {
          timer = window.setTimeout(() => void poll(), 4_000);
          return;
        }
        setActiveRunId(null);
        if (view.result) {
          setResult(view.result);
          await onImported();
          onError(null);
          onNotice(view.message);
          return;
        }
        onError(view.message);
      } catch (cause) {
        if (!stopped) {
          setActiveRunId(null);
          onError(messageForError(cause));
        }
      }
    };

    timer = window.setTimeout(() => void poll(), 1_500);
    return () => {
      stopped = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [activeRunId, onError, onImported, onNotice]);

  const resetRun = (nextDomain: string, nextLimit: number) => {
    setActiveRunId(null);
    setResult(null);
    setRunCommand(`py -3 apex.py --domain ${nextDomain} --limit ${nextLimit} --max-pages 40`);
  };

  const downloadScript = () => {
    const url = URL.createObjectURL(new Blob([script.content], { type: "text/x-python;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "apex.py";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    onError(null);
    onNotice("apex.py is gedownload. Bewaar het bestand in een eigen map op deze computer.");
  };

  const copyRunCommand = async () => {
    setPreparing(true);
    onError(null);
    try {
      const response = await fetch("/api/admin/price-monitor/apex-local", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain, limit }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      const session = (await response.json()) as PriceMonitorApexLocalSession;
      const command = `py -3 apex.py --domain ${domain} --limit ${limit} --max-pages 40 --upload-url "${window.location.origin}/api/price-monitor/apex-local/${session.runId}" --upload-token "${session.uploadToken}"`;
      setRunCommand(command);
      setActiveRunId(session.runId);
      try {
        await navigator.clipboard.writeText(command);
        onNotice("De gratis APEX-opdracht staat op je klembord. Voer hem binnen 30 minuten uit; het resultaat wordt daarna automatisch ingeladen.");
      } catch {
        onError("Kopiëren lukte niet. Selecteer de aangemaakte opdracht hieronder en kopieer hem handmatig; hij blijft 30 minuten geldig.");
      }
    } catch (cause) {
      setActiveRunId(null);
      onError(messageForError(cause));
    } finally {
      setPreparing(false);
    }
  };

  const importResult = async (file: File) => {
    setImporting(true);
    onError(null);
    try {
      const nextResult = await readLocalApexResult(file, domain);
      setResult(nextResult);
      onNotice(`${file.name} is lokaal gecontroleerd. Er is geen bestand verstuurd en geen live prijs aangepast.`);
    } catch (cause) {
      setResult(null);
      onError(messageForError(cause));
    } finally {
      setImporting(false);
    }
  };

  return (
    <section id="bronnen" aria-labelledby="sources-title" className="min-w-0 scroll-mt-24">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-accent-ink">APEX v9.1</p>
          <h2 id="sources-title" className="font-heading text-2xl font-bold text-text">APEX scraper</h2>
          <p className="text-body-sm text-muted">Alle webshops zitten al in APEX. Kies alleen welke webshop APEX in deze ronde lokaal moet scannen.</p>
        </div>
        <p className="text-xs font-semibold text-muted">€ 0 scrapingkosten · maximaal 25 producten</p>
      </div>

      <div className="mt-4 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-12">
        <article className="min-w-0 rounded-panel border border-border bg-surface p-5 shadow-card sm:p-6 xl:col-span-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-heading text-xl font-bold text-text">Gratis lokaal uitvoeren</h3>
              <p className="mt-1 text-body-sm text-muted">Geen abonnement, API-sleutel of betaalde scraperdienst. Alles draait op je eigen Windows-computer.</p>
            </div>
            <span className="inline-flex min-h-8 items-center rounded-full bg-emerald-100 px-3 text-xs font-bold text-emerald-800">Altijd gratis</span>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Welke webshop?">
              <select
                value={domain}
                onChange={(event) => {
                  const nextDomain = event.target.value;
                  setDomain(nextDomain);
                  resetRun(nextDomain, limit);
                }}
                className="min-h-12 w-full rounded-button border border-border bg-background px-3 text-base font-semibold text-text outline-none focus:border-border-hover"
              >
                {domains.map((source) => (
                  <option key={source.domain} value={source.domain}>
                    {source.domain} · {source.productCount} eerder gevonden
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Maximaal aantal producten">
              <select
                value={limit}
                onChange={(event) => {
                  const nextLimit = Number(event.target.value);
                  setLimit(nextLimit);
                  resetRun(domain, nextLimit);
                }}
                className="min-h-12 w-full rounded-button border border-border bg-background px-3 text-base font-semibold text-text outline-none focus:border-border-hover"
              >
                {[5, 10, 25].map((value) => <option key={value} value={value}>{value} producten</option>)}
              </select>
            </Field>
          </div>

          <ol className="mt-5 space-y-3 text-body-sm text-text">
            <li className="rounded-card bg-background p-3"><strong>1. Download</strong> het gecontroleerde bestand hieronder.</li>
            <li className="rounded-card bg-background p-3"><strong>2. Open PowerShell</strong> in dezelfde map en plak de uitvoeropdracht.</li>
            <li className="rounded-card bg-background p-3"><strong>3. Klaar</strong>: APEX laadt het resultaat automatisch en beveiligd in deze prijsmonitor.</li>
          </ol>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={downloadScript} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-button bg-accent px-4 font-heading font-bold text-contrast transition hover:bg-accent-hover">
              <Download className="h-5 w-5" aria-hidden="true" /> Download apex.py
            </button>
            <button type="button" onClick={() => void copyRunCommand()} disabled={!domain || !canRun || preparing || Boolean(activeRunId)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-button border border-border bg-surface px-4 font-heading font-bold text-text transition hover:border-border-hover disabled:opacity-50">
              <Code2 className="h-5 w-5" aria-hidden="true" /> {preparing ? "Opdracht maken…" : activeRunId ? "Wacht op APEX…" : "Maak automatische opdracht"}
            </button>
          </div>

          <div className="mt-4 min-w-0 max-w-full overflow-hidden rounded-card border border-border bg-contrast p-4 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-white/65">Eenmalig gratis installeren</p>
            <code className="mt-2 block max-w-full overflow-x-auto whitespace-nowrap text-xs">py -3 -m pip install requests beautifulsoup4 openpyxl</code>
            <p className="mt-4 text-xs font-bold uppercase tracking-[0.1em] text-white/65">Daarna deze ronde</p>
            <code className="mt-2 block max-w-full overflow-x-auto whitespace-nowrap text-xs">{runCommand}</code>
          </div>

          <div className="mt-4">
            <Field label="Handmatige reserve: lokaal JSON-resultaat">
              <input
                type="file"
                accept=".json,application/json"
                disabled={importing || !domain}
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = "";
                  if (file) void importResult(file);
                }}
                className="min-h-12 min-w-0 max-w-full cursor-pointer rounded-button border border-border bg-background px-3 py-2 text-base text-text file:mr-3 file:rounded-button file:border-0 file:bg-contrast file:px-3 file:py-2 file:font-bold file:text-white disabled:opacity-50"
              />
            </Field>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted">
            De browser mag uit veiligheid geen programma vanzelf starten. Daarom plak je de opdracht in PowerShell. APEX stuurt alleen het begrensde resultaat terug; daarvoor betaal je niets. Er ontstaat nooit automatisch een prijsactie.
          </p>

          {result ? (
            <div className="mt-5 rounded-panel border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
              <p className="text-xs font-bold uppercase tracking-[0.1em]">Lokaal ingelezen resultaat</p>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-body-sm">
                <div><dt className="text-xs opacity-75">Producten</dt><dd className="font-heading text-2xl font-bold tabular-nums">{result.productCount}</dd></div>
                <div><dt className="text-xs opacity-75">Prijsregels</dt><dd className="font-heading text-2xl font-bold tabular-nums">{result.priceRowCount}</dd></div>
                <div className="col-span-2"><dt className="text-xs opacity-75">Meetmoment</dt><dd className="font-bold">{shortDate(result.capturedAt)}</dd></div>
              </dl>
            </div>
          ) : null}
        </article>

        <article className="min-w-0 rounded-panel border border-border bg-contrast p-5 text-white shadow-card sm:p-6 xl:col-span-7">
          <div className="flex items-start gap-3">
            <Code2 className="mt-0.5 h-6 w-6 shrink-0 text-accent" aria-hidden="true" />
            <div className="min-w-0">
              <h3 className="font-heading text-xl font-bold text-white">Het scraperbestand dat wordt uitgevoerd</h3>
              <p className="mt-1 break-all text-xs text-white/65">{script.filename}</p>
              <p className="mt-1 text-xs text-white/65">Controlecode: {script.sha256.slice(0, 12)}</p>
            </div>
          </div>
          <details className="mt-5 overflow-hidden rounded-card border border-white/15 bg-black/20">
            <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 px-4 py-3 font-heading font-bold">
              Toon scraperbestand
              <ChevronDown className="h-5 w-5 shrink-0" aria-hidden="true" />
            </summary>
            <pre className="max-h-[34rem] overflow-auto border-t border-white/10 p-4 text-xs leading-relaxed text-white/85"><code>{script.content}</code></pre>
          </details>
          <p className="mt-4 text-xs leading-relaxed text-white/65">
            De controlecode hoort bij precies deze inhoud. Download en gebruik alleen dit bestand; vrije opdrachten of andere scripts worden niet aangeboden.
          </p>
        </article>
      </div>

      {result?.preview.length ? (
        <div className="mt-4 rounded-panel border border-border bg-surface p-5 shadow-card sm:p-6">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div><h3 className="font-heading text-xl font-bold">Voorbeeld uit het lokale resultaat</h3><p className="text-body-sm text-muted">De eerste tien gevonden regels. Controleer gewicht en verpakking voordat je vergelijkt.</p></div>
            <span className="text-xs font-bold text-emerald-800">Nieuwste meetstand</span>
          </div>
          <div className="mt-4 grid gap-3 lg:hidden">
            {result.preview.map((item, index) => (
              <article key={`${item.productUrl || item.productName}:${index}`} className="rounded-card border border-border bg-background p-4">
                <p className="font-heading font-bold">{item.productName}</p>
                <p className="mt-1 text-xs text-muted">{item.variantName}{item.sku ? ` · SKU ${item.sku}` : ""}</p>
                <p className="mt-3 font-heading text-xl font-bold">{item.priceCents === null ? "Prijs controleren" : euro(item.priceCents)}</p>
              </article>
            ))}
          </div>
          <div className="mt-4 hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[760px] border-collapse text-left text-body-sm">
              <thead><tr className="border-b border-border text-xs text-muted"><th className="px-3 py-3">Product</th><th className="px-3 py-3">Variant</th><th className="px-3 py-3">SKU</th><th className="px-3 py-3 text-right">Prijs</th><th className="px-3 py-3">Bron</th></tr></thead>
              <tbody>{result.preview.map((item, index) => (
                <tr key={`${item.productUrl || item.productName}:${index}`} className="border-b border-border last:border-0">
                  <td className="px-3 py-3 font-semibold">{item.productName}</td>
                  <td className="px-3 py-3 text-muted">{item.variantName}</td>
                  <td className="px-3 py-3 text-muted">{item.sku || "Ontbreekt"}</td>
                  <td className="px-3 py-3 text-right font-bold">{item.priceCents === null ? "Controleren" : euro(item.priceCents)}</td>
                  <td className="px-3 py-3">{item.productUrl ? <a href={item.productUrl} target="_blank" rel="noreferrer" className="font-semibold text-accent-ink hover:underline">Open <ExternalLink className="inline h-3.5 w-3.5" aria-hidden="true" /></a> : "Geen link"}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}

const MAX_LOCAL_APEX_FILE_BYTES = 20_000_000;

async function readLocalApexResult(
  file: File,
  expectedDomain: string
): Promise<PriceMonitorApexRunResult> {
  if (file.size <= 0 || file.size > MAX_LOCAL_APEX_FILE_BYTES) {
    throw new Error("APEX_LOCAL_FILE_SIZE");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error("APEX_LOCAL_FILE_JSON");
  }
  if (!isLocalRecord(parsed) || !Object.prototype.hasOwnProperty.call(parsed, expectedDomain)) {
    throw new Error("APEX_LOCAL_FILE_DOMAIN");
  }
  const rawProducts = parsed[expectedDomain];
  if (!Array.isArray(rawProducts) || rawProducts.length > 100_000) {
    throw new Error("APEX_LOCAL_FILE_FORMAT");
  }

  const preview: PriceMonitorApexRunResult["preview"] = [];
  let priceRowCount = 0;
  for (const rawProduct of rawProducts) {
    if (!isLocalRecord(rawProduct)) continue;
    const variants = Array.isArray(rawProduct.variants) && rawProduct.variants.length
      ? rawProduct.variants.slice(0, 100)
      : [{ title: "Standaard", price: rawProduct.price }];
    priceRowCount += variants.length;
    for (const rawVariant of variants) {
      if (preview.length >= 10 || !isLocalRecord(rawVariant)) continue;
      preview.push({
        domain: expectedDomain,
        productName: localText(rawProduct.name) || "Naam ontbreekt",
        variantName: localText(rawVariant.title) || "Standaard",
        productUrl: localProductUrl(rawProduct.url, expectedDomain),
        priceCents: localCents(rawVariant.price ?? rawProduct.price),
        sku: localText(rawVariant.sku) || localText(rawProduct.sku),
      });
    }
  }

  return {
    execution: `local-${file.name.replace(/[^a-z0-9.-]/gi, "-").slice(0, 60)}`,
    domain: expectedDomain,
    capturedAt: new Date(file.lastModified || Date.now()).toISOString(),
    productCount: rawProducts.length,
    priceRowCount,
    resultObject: file.name,
    preview,
  };
}

function isLocalRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function localText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function localCents(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}

function localProductUrl(value: unknown, domain: string): string | null {
  const candidate = localText(value);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    const hostname = url.hostname.toLocaleLowerCase("en-US");
    if (
      !["https:", "http:"].includes(url.protocol) ||
      (hostname !== domain && !hostname.endsWith(`.${domain}`))
    ) return null;
    return url.toString();
  } catch {
    return null;
  }
}

const APEX_SCAN_PAGE_SIZE = 50;

function ApexScanSection({ summary }: { summary: PriceMonitorApexScanSummary }) {
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [source, setSource] = useState("");
  const [offset, setOffset] = useState(0);
  const [result, setResult] = useState<PriceMonitorApexScanPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      limit: String(APEX_SCAN_PAGE_SIZE),
      offset: String(offset),
    });
    if (appliedQuery) params.set("q", appliedQuery);
    if (source) params.set("source", source);

    void fetch(`/api/admin/price-monitor/apex-scan?${params.toString()}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(await responseError(response));
        return (await response.json()) as PriceMonitorApexScanPage;
      })
      .then((page) => setResult(page))
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setLoadError(messageForError(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [appliedQuery, offset, requestVersion, source]);

  const queueReload = () => {
    setLoading(true);
    setLoadError(null);
    setRequestVersion((version) => version + 1);
  };

  const sortedSources = [...summary.sources].sort(
    (left, right) => right.productCount - left.productCount
  );
  const pageNumber = Math.floor(offset / APEX_SCAN_PAGE_SIZE) + 1;
  const pageCount = Math.max(
    1,
    Math.ceil((result?.total ?? 0) / APEX_SCAN_PAGE_SIZE)
  );
  const hasPrevious = offset > 0;
  const hasNext = Boolean(
    result && result.offset + result.items.length < result.total
  );

  return (
    <section aria-labelledby="apex-scan-title" className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-accent-ink">APEX v9.1 · eerste import</p>
          <h2 id="apex-scan-title" className="mt-1 font-heading text-2xl font-bold text-text">Scraperresultaat</h2>
          <p className="mt-1 max-w-3xl text-body-sm leading-relaxed text-muted">
            Dit is het aangeleverde resultaat van {shortDate(summary.capturedAt)}. Je kunt alle gevonden prijzen bekijken; ze tellen nog niet mee als goedgekeurde productvergelijking.
          </p>
        </div>
        <span className="inline-flex min-h-9 w-fit items-center rounded-full bg-slate-200 px-3 text-xs font-bold text-slate-800">
          Alleen bekijken
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          ["Webshops opgegeven", summary.listedSources],
          ["Met resultaat", summary.sourcesWithResults],
          ["Producten", summary.productCount],
          ["Prijsregels", summary.priceRowCount],
        ].map(([label, value]) => (
          <article key={label} className="min-w-0 rounded-panel border border-border bg-surface p-4 shadow-card sm:p-5">
            <p className="font-heading text-3xl font-bold tabular-nums text-text">{Number(value).toLocaleString("nl-NL")}</p>
            <p className="mt-1 text-xs font-semibold text-muted">{label}</p>
          </article>
        ))}
      </div>

      <details className="rounded-panel border border-border bg-surface shadow-card">
        <summary className="flex min-h-14 cursor-pointer items-center justify-between gap-3 px-4 py-3 font-heading font-bold sm:px-5">
          Webshops in deze scan
          <span className="text-xs font-semibold text-muted">{summary.sourcesWithResults} met resultaat · {summary.listedSources - summary.sourcesWithResults} zonder resultaat</span>
        </summary>
        <div className="grid gap-2 border-t border-border p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sortedSources.map((item) => (
            <div key={item.domain} className="flex min-w-0 items-center justify-between gap-3 rounded-card bg-background p-3">
              <span className="min-w-0 truncate text-body-sm font-bold text-text">{item.domain}</span>
              <span className={cn("shrink-0 rounded-full px-2 py-1 text-[11px] font-bold", item.productCount ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700")}>
                {item.productCount ? `${item.productCount} producten` : "Geen resultaat"}
              </span>
            </div>
          ))}
        </div>
      </details>

      <div className="rounded-panel border border-border bg-surface p-4 shadow-card sm:p-5">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            queueReload();
            setOffset(0);
            setAppliedQuery(query.trim());
          }}
          className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(14rem,0.35fr)_auto]"
        >
          <label className="block">
            <span className="mb-1.5 block text-body-sm font-bold text-text">Zoek product of SKU</span>
            <span className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" aria-hidden="true" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Bijvoorbeeld amandelen" className="min-h-12 w-full rounded-button border border-border bg-background pl-10 pr-3 text-base text-text outline-none focus:border-border-hover" />
            </span>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-body-sm font-bold text-text">Webshop</span>
            <select value={source} onChange={(event) => { queueReload(); setSource(event.target.value); setOffset(0); }} className="min-h-12 w-full rounded-button border border-border bg-background px-3 text-base text-text outline-none focus:border-border-hover">
              <option value="">Alle webshops</option>
              {sortedSources.map((item) => <option key={item.domain} value={item.domain}>{item.domain} ({item.priceRowCount})</option>)}
            </select>
          </label>
          <button type="submit" className="min-h-12 self-end rounded-button bg-contrast px-5 font-heading font-bold text-white">Zoeken</button>
        </form>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="font-heading text-xl font-bold text-text">Gevonden prijzen</h3>
          <p aria-live="polite" className="text-body-sm text-muted">
            {loading && !result ? "Resultaten laden…" : `${(result?.total ?? 0).toLocaleString("nl-NL")} prijsregels gevonden`}
          </p>
        </div>
        <p className="text-xs font-semibold text-muted">Bestand: {summary.resultFile.split("/").at(-1)}</p>
      </div>

      {loadError ? (
        <div role="alert" className="rounded-panel border border-red-200 bg-red-50 p-4 text-body-sm font-semibold text-red-950">Het scraperresultaat kon niet worden geladen ({loadError}).</div>
      ) : null}

      {result?.items.length ? (
        <>
          <div className="grid gap-3 lg:hidden">
            {result.items.map((item) => (
              <article key={item.id} className="rounded-panel border border-border bg-surface p-4 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-[0.08em] text-accent-ink">{item.domain}</p>
                    <h4 className="mt-1 font-heading text-lg font-bold leading-tight text-text">{item.productName}</h4>
                    <p className="mt-1 text-xs text-muted">{item.variantName}</p>
                  </div>
                  <p className="shrink-0 font-heading text-xl font-bold tabular-nums text-text">{item.priceCents === null ? "—" : euro(item.priceCents)}</p>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 rounded-card bg-background p-3 text-body-sm">
                  <div><dt className="text-xs text-muted">Verpakking</dt><dd className="font-bold">{item.packageLabel ?? "Niet gevonden"}</dd></div>
                  <div><dt className="text-xs text-muted">SKU</dt><dd className="break-all font-bold">{item.sku ?? "Niet gevonden"}</dd></div>
                </dl>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex min-h-7 items-center rounded-full bg-amber-100 px-2.5 text-[11px] font-bold text-amber-900">Even controleren</span>
                  {item.qualityIssues.slice(0, 3).map((issue) => <span key={issue} className="text-xs font-semibold text-muted">{issue}</span>)}
                </div>
                {item.productUrl ? <a href={item.productUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-11 items-center gap-1 font-heading text-sm font-bold text-text underline underline-offset-4">Open bron <ExternalLink className="h-4 w-4" aria-hidden="true" /></a> : null}
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-panel border border-border bg-surface shadow-card lg:block">
            <table className="w-full min-w-[64rem] border-collapse text-left text-body-sm">
              <thead className="bg-background text-xs uppercase tracking-[0.06em] text-muted">
                <tr><th className="p-3">Webshop</th><th className="p-3">Product</th><th className="p-3">Prijs</th><th className="p-3">Verpakking</th><th className="p-3">SKU</th><th className="p-3">Controle</th><th className="p-3"><span className="sr-only">Bron</span></th></tr>
              </thead>
              <tbody>
                {result.items.map((item) => (
                  <tr key={item.id} className="border-t border-border align-top">
                    <td className="p-3 font-bold text-text">{item.domain}</td>
                    <td className="max-w-sm p-3"><span className="block font-bold text-text">{item.productName}</span><span className="mt-0.5 block text-xs text-muted">{item.variantName}</span></td>
                    <td className="p-3 font-bold tabular-nums text-text">{item.priceCents === null ? "—" : euro(item.priceCents)}</td>
                    <td className="p-3 text-muted">{item.packageLabel ?? "Niet gevonden"}</td>
                    <td className="max-w-44 break-all p-3 text-xs font-semibold text-muted">{item.sku ?? "Niet gevonden"}</td>
                    <td className="p-3"><span className="inline-flex min-h-7 items-center rounded-full bg-amber-100 px-2.5 text-[11px] font-bold text-amber-900">Even controleren</span><span className="mt-1 block max-w-56 text-xs text-muted">{item.qualityIssues.join(" · ")}</span></td>
                    <td className="p-3">{item.productUrl ? <a href={item.productUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-button border border-border" aria-label={`Open bron voor ${item.productName}`}><ExternalLink className="h-4 w-4" aria-hidden="true" /></a> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : !loading && !loadError ? (
        <EmptyState icon={Search} title="Geen prijsregels gevonden" text="Pas je zoekopdracht of webshopfilter aan." />
      ) : null}

      <div className="flex flex-col gap-3 rounded-panel border border-border bg-surface p-3 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <p className="text-center text-body-sm font-semibold text-muted sm:text-left">Pagina {pageNumber} van {pageCount}</p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={!hasPrevious || loading} onClick={() => { queueReload(); setOffset(Math.max(0, offset - APEX_SCAN_PAGE_SIZE)); }} className="inline-flex min-h-12 items-center justify-center gap-1 rounded-button border border-border px-4 font-heading text-sm font-bold disabled:opacity-40"><ChevronLeft className="h-4 w-4" aria-hidden="true" /> Vorige</button>
          <button type="button" disabled={!hasNext || loading} onClick={() => { queueReload(); setOffset(offset + APEX_SCAN_PAGE_SIZE); }} className="inline-flex min-h-12 items-center justify-center gap-1 rounded-button bg-contrast px-4 font-heading text-sm font-bold text-white disabled:opacity-40">Volgende <ChevronRight className="h-4 w-4" aria-hidden="true" /></button>
        </div>
      </div>

      <p className="text-xs leading-relaxed text-muted">Juiste scraperbestand: {summary.scraperFile}. Deze import is alleen-lezen; een nieuwe begrensde ronde start je met de APEX scraper.</p>
    </section>
  );
}

function PriceMonitorSafetyFooter({ summary }: { summary: PriceMonitorApexScanSummary }) {
  const missingPackageRows = Math.max(0, summary.priceRowCount - summary.rowsWithPackage);
  return (
    <section aria-labelledby="apex-improvements-title" className="rounded-panel border border-amber-300 bg-amber-50 p-5 text-amber-950 shadow-card sm:p-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-amber-800">Controle onderaan de prijsmonitor</p>
          <h2 id="apex-improvements-title" className="mt-1 font-heading text-xl font-bold">Nog niet gebruiken voor een prijsactie</h2>
          <p className="mt-2 text-body-sm leading-relaxed">
            In deze scan ontbreekt bij {missingPackageRows.toLocaleString("nl-NL")} van de {summary.priceRowCount.toLocaleString("nl-NL")} prijsregels het gewicht of de verpakking. Daardoor zijn nu {summary.readyForComparisonRows.toLocaleString("nl-NL")} regels veilig naar prijs per kilo om te rekenen. {summary.invalidPriceRows} regels hebben daarnaast een nulprijs en {summary.suspectHighPriceRows} prijzen vragen controle omdat ze hoger zijn dan € 100.
          </p>

          <h3 className="mt-5 font-heading font-bold">Welke verbeteringen APEX nog nodig heeft</h3>
          <ul className="mt-2 grid gap-2 text-body-sm leading-relaxed sm:grid-cols-2">
            <li className="rounded-card bg-white/60 p-3">Gewicht en inhoud herkennen uit productnaam, variantnaam, keuzelijsten en gestructureerde productgegevens.</li>
            <li className="rounded-card bg-white/60 p-3">De gewone prijs en actieprijs apart opslaan, zodat een tijdelijke korting nooit als vaste prijs wordt gezien.</li>
            <li className="rounded-card bg-white/60 p-3">SKU en EAN consequenter ophalen voor een betrouwbare productkoppeling.</li>
            <li className="rounded-card bg-white/60 p-3">Voorraadstatus vastleggen en nulprijzen of onwaarschijnlijke prijzen apart laten controleren.</li>
          </ul>

          <p className="mt-4 text-body-sm leading-relaxed">
            Een prijsvoorstel wordt niet op de verpakking gebaseerd. De monitor vergelijkt onze prijs en de prijs van de concurrent omgerekend naar dezelfde eenheid, meestal euro per kilo. Gewicht of inhoud is alleen nodig om die eerlijke eenheidsprijs te berekenen; ontbrekende gegevens worden nooit gegokt.
          </p>
          <p className="mt-3 text-body-sm font-bold">
            Niet automatisch: niets uit een scrape maakt of publiceert een live prijsvoorstel. Een prijswijziging blijft een aparte, handmatig bevestigde actie.
          </p>
        </div>
      </div>
    </section>
  );
}

function ComparisonSection({
  comparisons,
  total,
  query,
  onlySignificant,
  onlyReview,
  busy,
  onQuery,
  onOnlySignificant,
  onOnlyReview,
  onReview,
  onAction,
}: {
  comparisons: PriceMonitorComparisonView[];
  total: number;
  query: string;
  onlySignificant: boolean;
  onlyReview: boolean;
  busy: string | null;
  onQuery: (value: string) => void;
  onOnlySignificant: (value: boolean) => void;
  onOnlyReview: (value: boolean) => void;
  onReview: (id: string, decision: "APPROVE" | "REJECT") => void;
  onAction: (item: PriceMonitorComparisonView) => void;
}) {
  return (
    <section aria-labelledby="compare-title" className="space-y-4">
      <div>
        <h2 id="compare-title" className="font-heading text-2xl font-bold text-text">Prijzen vergelijken</h2>
        <p className="text-body-sm text-muted">Wij vergelijken op gelijk gewicht. Onzekere koppelingen tellen pas mee nadat jij ze goedkeurt.</p>
      </div>
      <div className="rounded-panel border border-border bg-surface p-4 shadow-card">
        <label className="relative block">
          <span className="sr-only">Zoek op product, SKU of webshop</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Zoek product, SKU of webshop"
            className="min-h-12 w-full rounded-button border border-border bg-background pl-11 pr-4 text-base text-text outline-none focus:border-border-hover"
          />
        </label>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <FilterCheck checked={onlySignificant} onChange={onOnlySignificant} label="Alleen opvallende verschillen" />
          <FilterCheck checked={onlyReview} onChange={onOnlyReview} label="Alleen koppelingen controleren" />
        </div>
        <p className="mt-3 text-xs font-semibold text-muted">{comparisons.length} van {total} vergelijkingen zichtbaar</p>
      </div>

      {!comparisons.length ? (
        <EmptyState
          icon={SlidersHorizontal}
          title={total ? "Geen producten passen bij deze filters" : "Nog geen producten om te vergelijken"}
          text={total ? "Wis de filters of zoek op een andere naam." : "Start eerst een proefronde en controleer daarna de voorgestelde productkoppelingen."}
        />
      ) : (
        <>
          <div className="grid gap-3 lg:hidden">
            {comparisons.map((item) => (
              <ComparisonCard key={item.matchId} item={item} busy={busy} onReview={onReview} onAction={onAction} />
            ))}
          </div>
          <div className="hidden overflow-hidden rounded-panel border border-border bg-surface shadow-card lg:block">
            <table className="w-full table-fixed text-left text-body-sm">
              <thead className="bg-background text-xs uppercase tracking-[0.08em] text-muted">
                <tr>
                  <th className="w-[25%] px-4 py-3">Product</th>
                  <th className="w-[15%] px-4 py-3">Onze prijs</th>
                  <th className="w-[17%] px-4 py-3">Concurrent</th>
                  <th className="w-[12%] px-4 py-3">Verschil</th>
                  <th className="w-[14%] px-4 py-3">Kwaliteit</th>
                  <th className="w-[17%] px-4 py-3">Actie</th>
                </tr>
              </thead>
              <tbody>
                {comparisons.map((item) => (
                  <tr key={item.matchId} className="border-t border-border align-top">
                    <td className="px-4 py-4"><p className="font-bold text-text">{item.ownProduct}</p><p className="mt-1 text-xs text-muted">{item.ownVariant} · {item.ownSku}</p></td>
                    <td className="px-4 py-4 tabular-nums"><p className="font-bold">{euro(item.ownPriceCents)}</p><p className="mt-1 text-xs text-muted">{euro(item.ownNormalizedPriceCents)}/kg</p></td>
                    <td className="px-4 py-4"><a href={item.competitorUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center font-bold text-accent-ink underline-offset-2 hover:underline">{item.competitor}</a><p className="mt-1 line-clamp-2 text-xs text-muted">{item.competitorProduct}</p></td>
                    <td className="px-4 py-4"><Difference value={item.differenceBps} /></td>
                    <td className="px-4 py-4"><QualityPill score={item.dataQualityScore} flags={item.qualityFlags} /><p className="mt-2 text-xs text-muted">Match {item.matchConfidenceScore}%</p></td>
                    <td className="px-4 py-4"><RowActions item={item} busy={busy} onReview={onReview} onAction={onAction} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function ComparisonCard({ item, busy, onReview, onAction }: { item: PriceMonitorComparisonView; busy: string | null; onReview: (id: string, decision: "APPROVE" | "REJECT") => void; onAction: (item: PriceMonitorComparisonView) => void }) {
  return (
    <article className="rounded-panel border border-border bg-surface p-4 shadow-card sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><h3 className="font-heading text-lg font-bold text-text">{item.ownProduct}</h3><p className="text-xs font-semibold text-muted">{item.ownVariant} · {item.ownSku}</p></div>
        <QualityPill score={item.dataQualityScore} flags={item.qualityFlags} />
      </div>
      <dl className="mt-4 grid gap-3 rounded-card bg-background p-3 text-body-sm sm:grid-cols-2">
        <div><dt className="text-xs text-muted">Onze prijs</dt><dd className="font-bold tabular-nums text-text">{euro(item.ownPriceCents)} · {euro(item.ownNormalizedPriceCents)}/kg</dd></div>
        <div><dt className="text-xs text-muted"><a href={item.competitorUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center font-semibold text-accent-ink underline-offset-2 hover:underline">{item.competitor}</a></dt><dd className="font-bold tabular-nums text-text">{euro(item.competitorEquivalentPriceCents)} gelijk gewicht · {euro(item.competitorNormalizedPriceCents)}/kg</dd></div>
      </dl>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <Difference value={item.differenceBps} />
        <span className="text-xs font-semibold text-muted">Gemeten {shortDate(item.observedAt)}</span>
      </div>
      <p className="mt-3 text-body-sm text-muted">{item.matchStatus === "SUGGESTED" ? `Koppeling nog controleren (${item.matchConfidenceScore}% zeker).` : `Koppeling goedgekeurd (${item.matchConfidenceScore}% zeker).`}</p>
      <div className="mt-4"><RowActions item={item} busy={busy} onReview={onReview} onAction={onAction} /></div>
    </article>
  );
}

function RowActions({ item, busy, onReview, onAction }: { item: PriceMonitorComparisonView; busy: string | null; onReview: (id: string, decision: "APPROVE" | "REJECT") => void; onAction: (item: PriceMonitorComparisonView) => void }) {
  if (item.matchStatus === "SUGGESTED") {
    return (
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <button type="button" disabled={busy !== null} onClick={() => onReview(item.matchId, "APPROVE")} className="inline-flex min-h-11 items-center justify-center gap-1 rounded-button bg-contrast px-3 font-heading text-sm font-bold text-white disabled:opacity-50"><Check className="h-4 w-4" aria-hidden="true" /> Klopt</button>
        <button type="button" disabled={busy !== null} onClick={() => onReview(item.matchId, "REJECT")} className="inline-flex min-h-11 items-center justify-center gap-1 rounded-button border border-border px-3 font-heading text-sm font-bold disabled:opacity-50"><X className="h-4 w-4" aria-hidden="true" /> Niet gelijk</button>
      </div>
    );
  }
  if (isActionableRecommendation(item)) {
    return <button type="button" disabled={busy !== null} onClick={() => onAction(item)} className="min-h-11 w-full rounded-button bg-accent px-3 font-heading text-sm font-bold text-contrast disabled:opacity-50">Bekijk voorstel</button>;
  }
  const label = item.qualityFlags.includes("STALE")
    ? "Nieuwe prijsronde nodig"
    : item.qualityFlags.includes("OUT_OF_STOCK")
      ? "Concurrent niet op voorraad"
      : item.qualityFlags.includes("COMPETITOR_PROMOTION")
        ? "Concurrentaanbieding controleren"
        : item.qualityFlags.includes("UNVERIFIED_PRICE_SOURCE")
          ? "Prijsbron handmatig controleren"
      : item.recommendationType === "KEEP"
        ? "Prijs behouden"
        : "Geen open actie";
  return <span className="inline-flex min-h-9 items-center rounded-full bg-background px-3 text-xs font-bold text-muted">{label}</span>;
}

function ActionsSection({ items, reviewCount, disabled, onOpenAction, onOpenReview }: { items: PriceMonitorComparisonView[]; reviewCount: number; disabled: boolean; onOpenAction: (item: PriceMonitorComparisonView) => void; onOpenReview: () => void }) {
  return (
    <section aria-labelledby="actions-title" className="space-y-4">
      <div><h2 id="actions-title" className="font-heading text-2xl font-bold text-text">Conceptacties</h2><p className="text-body-sm text-muted">Voorstellen zijn aanpasbaar. Ze veranderen nooit vanzelf een productprijs.</p></div>
      {reviewCount > 0 ? (
        <button type="button" onClick={onOpenReview} className="flex min-h-14 w-full items-center justify-between gap-4 rounded-panel border border-amber-300 bg-amber-50 p-4 text-left text-amber-950">
          <span><span className="block font-heading font-bold">Eerst {reviewCount} productkoppelingen controleren</span><span className="block text-body-sm">Zonder goedgekeurde match maakt de Prijscoach geen uitvoerbaar voorstel.</span></span>
          <ArrowUp className="h-5 w-5 rotate-90" aria-hidden="true" />
        </button>
      ) : null}
      {!items.length ? (
        <EmptyState icon={Sparkles} title="Geen conceptacties klaar" text="Na een goede prijsronde en goedgekeurde productkoppelingen verschijnen hier alleen relevante voorstellen." />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {items.map((item) => (
            <article key={item.recommendationId} className="rounded-panel border border-border bg-surface p-5 shadow-card">
              <div className="flex items-start justify-between gap-3"><div><h3 className="font-heading text-lg font-bold">{item.ownProduct}</h3><p className="text-xs text-muted">Gebaseerd op {item.competitor} · kwaliteit {item.dataQualityScore}%</p></div><Difference value={item.differenceBps} /></div>
              <div className="mt-4 grid grid-cols-2 gap-3 rounded-card bg-background p-3"><div><p className="text-xs text-muted">Nu</p><p className="font-heading text-xl font-bold tabular-nums">{euro(item.ownPriceCents)}</p></div><div><p className="text-xs text-muted">Voorstel</p><p className="font-heading text-xl font-bold tabular-nums">{item.suggestedPriceCents === null ? "—" : euro(item.suggestedPriceCents)}</p></div></div>
              {item.scenarioImpactPer100Cents !== null ? <p className="mt-3 rounded-card border border-border bg-background p-3 text-body-sm font-semibold text-text">{scenarioImpact(item.scenarioImpactPer100Cents)}</p> : null}
              <p className="mt-4 text-body-sm leading-relaxed text-muted">{item.rationale}</p>
              <button type="button" disabled={disabled} onClick={() => onOpenAction(item)} className="mt-4 min-h-12 w-full rounded-button bg-accent px-4 font-heading font-bold text-contrast disabled:opacity-50">Controleren en aanpassen</button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function ReportsSection({ dashboard, disabled, onSaved, onError }: { dashboard: PriceMonitorDashboard; disabled: boolean; onSaved: () => Promise<void>; onError: (message: string) => void }) {
  const [enabled, setEnabled] = useState(dashboard.schedule.enabled);
  const [frequency, setFrequency] = useState(dashboard.schedule.frequency);
  const [hourLocal, setHourLocal] = useState(dashboard.schedule.hourLocal);
  const [recipientEmail, setRecipientEmail] = useState(dashboard.schedule.recipientEmail);
  const [minDifferencePercent, setMinDifferencePercent] = useState(dashboard.schedule.minDifferencePercent);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/price-monitor/reports/schedule", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          enabled,
          frequency,
          hourLocal,
          dayOfWeek: frequency === "WEEKLY" ? 1 : null,
          dayOfMonth: frequency === "MONTHLY" ? 1 : null,
          recipientEmail,
          formats: ["CSV", "PRINT"],
          minDifferencePercent,
        }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      await onSaved();
    } catch (cause) { onError(messageForError(cause)); }
    finally { setSaving(false); }
  };
  return (
    <section aria-labelledby="reports-title" className="space-y-5">
      <div><h2 id="reports-title" className="font-heading text-2xl font-bold text-text">Rapporten en exports</h2><p className="text-body-sm text-muted">Download wat jij nodig hebt of ontvang automatisch een leesbare e-mailsamenvatting.</p></div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Link href="/api/admin/price-monitor/reports/export?format=csv" prefetch={false} download className="flex min-h-20 items-center gap-3 rounded-panel border border-border bg-surface p-4 font-heading font-bold text-text shadow-card transition hover:border-border-hover"><Download className="h-6 w-6 text-accent-ink" aria-hidden="true" /><span>Excel / CSV<span className="block font-body text-xs font-normal text-muted">Alle vergelijkingsregels</span></span></Link>
        <Link href="/api/admin/price-monitor/reports/export?format=json" prefetch={false} download className="flex min-h-20 items-center gap-3 rounded-panel border border-border bg-surface p-4 font-heading font-bold text-text shadow-card transition hover:border-border-hover"><FileJson className="h-6 w-6 text-accent-ink" aria-hidden="true" /><span>Technische JSON<span className="block font-body text-xs font-normal text-muted">Voor verdere verwerking</span></span></Link>
        <button type="button" onClick={() => window.print()} className="flex min-h-20 items-center gap-3 rounded-panel border border-border bg-surface p-4 text-left font-heading font-bold text-text shadow-card transition hover:border-border-hover"><Printer className="h-6 w-6 text-accent-ink" aria-hidden="true" /><span>Print / PDF<span className="block font-body text-xs font-normal text-muted">Gebruik Afdrukken als PDF</span></span></button>
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.65fr)]">
        <form onSubmit={(event) => { event.preventDefault(); void save(); }} className="rounded-panel border border-border bg-surface p-5 shadow-card sm:p-6">
          <div className="flex items-start gap-3"><CalendarClock className="mt-0.5 h-6 w-6 text-accent-ink" aria-hidden="true" /><div><h3 className="font-heading text-xl font-bold">Automatisch rapport</h3><p className="text-body-sm text-muted">Je ontvangt een managementsamenvatting met link naar de beveiligde prijsmonitor.</p></div></div>
          <label className="mt-5 flex min-h-12 cursor-pointer items-center gap-3 rounded-card border border-border p-3"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} className="h-5 w-5 accent-[#806600]" /><span className="font-heading font-bold">Automatische e-mail aanzetten</span></label>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Hoe vaak"><select value={frequency} onChange={(event) => setFrequency(event.target.value as typeof frequency)} className="min-h-12 w-full rounded-button border border-border bg-background px-3 text-base text-text outline-none focus:border-border-hover"><option value="DAILY">Dagelijks</option><option value="WEEKLY">Iedere maandag</option><option value="MONTHLY">Iedere eerste dag van de maand</option></select></Field>
            <Field label="Tijd"><select value={hourLocal} onChange={(event) => setHourLocal(Number(event.target.value))} className="min-h-12 w-full rounded-button border border-border bg-background px-3 text-base text-text outline-none focus:border-border-hover">{[6,7,8,9,10,12,15].map((hour) => <option key={hour} value={hour}>{String(hour).padStart(2,"0")}:00 uur</option>)}</select></Field>
            <Field label="Ontvanger"><input type="email" value={recipientEmail} onChange={(event) => setRecipientEmail(event.target.value)} placeholder="naam@bedrijf.nl" className="min-h-12 w-full rounded-button border border-border bg-background px-3 text-base text-text outline-none focus:border-border-hover" /></Field>
            <Field label="Opvallend vanaf"><div className="relative"><input type="number" min={1} max={100} step={0.5} value={minDifferencePercent} onChange={(event) => setMinDifferencePercent(Number(event.target.value))} className="min-h-12 w-full rounded-button border border-border bg-background px-3 pr-10 text-base text-text outline-none focus:border-border-hover" /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-bold text-muted">%</span></div></Field>
          </div>
          <button type="submit" disabled={disabled || saving} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-button bg-contrast px-5 font-heading font-bold text-white disabled:opacity-50 sm:w-auto"><Mail className="h-5 w-5" aria-hidden="true" />{saving ? "Opslaan…" : "Rapportinstellingen opslaan"}</button>
        </form>
        <aside className="rounded-panel border border-border bg-background p-5 sm:p-6">
          <h3 className="font-heading text-lg font-bold">Status rapportage</h3>
          <dl className="mt-4 space-y-4 text-body-sm"><div><dt className="text-xs text-muted">Automatisch</dt><dd className="font-bold">{dashboard.schedule.enabled ? "Actief" : "Uitgeschakeld"}</dd></div><div><dt className="text-xs text-muted">Volgende rapport</dt><dd className="font-bold">{dashboard.schedule.nextRunAt ? shortDate(dashboard.schedule.nextRunAt) : "Nog niet gepland"}</dd></div><div><dt className="text-xs text-muted">Laatste verzending</dt><dd className="font-bold">{dashboard.schedule.lastSentAt ? shortDate(dashboard.schedule.lastSentAt) : "Nog nooit"}</dd></div><div><dt className="text-xs text-muted">Laatste status</dt><dd className="font-bold">{dashboard.schedule.lastStatus === "FAILED" ? "Verzending mislukt" : dashboard.schedule.lastStatus === "SENT" ? "Verzonden" : "Nog niet uitgevoerd"}</dd></div></dl>
          {dashboard.schedule.lastError ? <p role="alert" className="mt-4 rounded-card border border-red-200 bg-red-50 p-3 text-body-sm text-red-900">{dashboard.schedule.lastError}</p> : null}
          <p className="mt-5 text-xs leading-relaxed text-muted">Automatische e-mail vereist na deployment een beveiligde Cloud Scheduler-aanroep. Zonder die planning blijft de instelling veilig bewaard, maar wordt er niets verstuurd.</p>
        </aside>
      </div>
    </section>
  );
}

function HelpSection() {
  return (
    <section aria-labelledby="help-title" className="grid gap-4 lg:grid-cols-2">
      <article className="rounded-panel border border-border bg-surface p-5 shadow-card sm:p-6"><h2 id="help-title" className="font-heading text-2xl font-bold">Wat kijkt de tool na?</h2><ul className="mt-4 space-y-3 text-body-sm leading-relaxed text-muted"><HelpItem>Of productnaam, variant en gewicht echt bij elkaar horen.</HelpItem><HelpItem>Of de prijs geldig is en naar prijs per kilo kan worden omgerekend.</HelpItem><HelpItem>Of een prijs onwaarschijnlijk laag of hoog is.</HelpItem><HelpItem>Of de gegevens vers genoeg zijn voor een besluit.</HelpItem><HelpItem>Of wij minimaal 8% hoger of lager zitten voordat een voorstel relevant wordt.</HelpItem></ul></article>
      <article className="rounded-panel border border-border bg-surface p-5 shadow-card sm:p-6"><h2 className="font-heading text-2xl font-bold">Wat doet de tool nooit vanzelf?</h2><ul className="mt-4 space-y-3 text-body-sm leading-relaxed text-muted"><HelpItem>Een onzekere productkoppeling als waarheid behandelen.</HelpItem><HelpItem>Een actieve aanbiedingsprijs overschrijven.</HelpItem><HelpItem>Een wijziging groter dan 15% uitvoeren.</HelpItem><HelpItem>Doen alsof omzet hetzelfde is als winst.</HelpItem><HelpItem>Een prijs wijzigen zonder jouw expliciete margecontrole en bevestiging.</HelpItem></ul></article>
      <article className="rounded-panel border border-accent bg-amber-50 p-5 lg:col-span-2 sm:p-6"><div className="flex items-start gap-3"><Info className="mt-0.5 h-6 w-6 shrink-0 text-accent-ink" aria-hidden="true" /><div><h2 className="font-heading text-xl font-bold">Waarom de APEX-scan nog geen prijsadvies is</h2><p className="mt-1 text-body-sm leading-relaxed text-muted">Het eerste APEX-resultaat staat nu als alleen-lezen bron in dit scherm. De gevonden prijzen missen nog een betrouwbaar gewicht of verpakking. Daarom kun je ze wel bekijken, maar gebruikt de Prijscoach ze nog niet voor een voorstel of live prijswijziging.</p></div></div></article>
    </section>
  );
}

function PriceMonitorPrint({ dashboard }: { dashboard: PriceMonitorDashboard }) {
  return (
    <section className="price-monitor-print hidden bg-white text-black" aria-label="Afdrukversie prijsrapport">
      <p className="text-sm font-bold uppercase tracking-[0.12em]">De Notenman</p>
      <h1 className="mt-2 text-3xl font-bold">Prijsmonitorrapport</h1>
      <p className="mt-1 text-sm">Gemaakt op {shortDate(dashboard.generatedAt)}</p>
      <div className="mt-6 grid grid-cols-4 gap-3">
        <PrintMetric label="Bronnen" value={`${dashboard.summary.connectedSources}/${dashboard.summary.totalSources}`} />
        <PrintMetric label="Producten" value={String(dashboard.summary.productsObserved)} />
        <PrintMetric label="Opvallend" value={String(dashboard.summary.significantDifferences)} />
        <PrintMetric label="Datakwaliteit" value={dashboard.summary.averageDataQualityScore === null ? "Nog niet" : `${dashboard.summary.averageDataQualityScore}%`} />
      </div>
      <h2 className="mt-8 text-xl font-bold">Grootste verschillen</h2>
      <table className="mt-3 w-full border-collapse text-left text-xs">
        <thead><tr><th className="border border-slate-300 p-2">Product</th><th className="border border-slate-300 p-2">Bron</th><th className="border border-slate-300 p-2">Onze prijs</th><th className="border border-slate-300 p-2">Concurrent gelijk gewicht</th><th className="border border-slate-300 p-2">Verschil</th><th className="border border-slate-300 p-2">Status</th></tr></thead>
        <tbody>{[...dashboard.comparisons].sort((a,b) => Math.abs(b.differenceBps) - Math.abs(a.differenceBps)).slice(0, 40).map((item) => <tr key={item.matchId}><td className="border border-slate-300 p-2">{item.ownProduct}<br/><span className="text-slate-600">{item.ownVariant}</span></td><td className="border border-slate-300 p-2">{item.competitor}</td><td className="border border-slate-300 p-2">{euro(item.ownPriceCents)}</td><td className="border border-slate-300 p-2">{euro(item.competitorEquivalentPriceCents)}</td><td className="border border-slate-300 p-2">{signedPercent(item.differenceBps)}</td><td className="border border-slate-300 p-2">{item.safeForAnalysis ? "Goedgekeurd" : "Controleren / niet gebruiken"}</td></tr>)}</tbody>
      </table>
      {!dashboard.comparisons.length ? <p className="mt-4">Nog geen goed vergelijkbare producten.</p> : null}
      <p className="mt-8 border-t border-slate-300 pt-3 text-xs">Controleer productmatch, inkoopprijs, btw, marge, voorraad en actieve promoties voordat je een prijsactie uitvoert. Scenario's per 100 verpakkingen zijn omzetverschillen en geen winstprognoses.</p>
    </section>
  );
}

function PrintMetric({ label, value }: { label: string; value: string }) {
  return <div className="border border-slate-300 p-3"><p className="text-xs text-slate-600">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></div>;
}

function PriceActionDialog({ item, onClose, onApplied, onError }: { item: PriceMonitorComparisonView; onClose: () => void; onApplied: (frontendSynced: boolean) => Promise<void>; onError: (message: string) => void }) {
  const [target, setTarget] = useState(((item.suggestedPriceCents || item.ownPriceCents) / 100).toFixed(2).replace(".", ","));
  const [marginChecked, setMarginChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const targetCents = Math.round(Number(target.replace(",", ".")) * 100);
  const changeBps = Number.isFinite(targetCents) ? Math.round(((targetCents - item.ownPriceCents) / item.ownPriceCents) * 10_000) : 0;
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusables = () => dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href]');
    focusables()?.[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const list = focusables();
      if (!list?.length) return;
      const first = list[0]; const last = list[list.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [onClose]);
  const apply = async () => {
    if (!item.recommendationId) return;
    setSubmitting(true);
    try {
      const response = await fetch(`/api/admin/price-monitor/recommendations/${item.recommendationId}/apply`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedCurrentPriceCents: item.ownPriceCents, targetPriceCents: targetCents, marginChecked }) });
      if (!response.ok) throw new Error(await responseError(response));
      const result = (await response.json()) as { frontendSynced?: boolean };
      await onApplied(result.frontendSynced !== false);
    } catch (cause) { onError(messageForError(cause)); setSubmitting(false); }
  };
  const valid = marginChecked && Number.isInteger(targetCents) && targetCents >= 50 && targetCents !== item.ownPriceCents && Math.abs(changeBps) <= 1500;
  return (
    <div className="fixed inset-0 z-50 bg-black/50 sm:flex sm:justify-end" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="action-dialog-title" className="h-full w-full overflow-y-auto bg-surface px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] shadow-card-hover sm:max-w-lg sm:px-6">
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-accent-ink">Laatste controle</p><h2 id="action-dialog-title" className="font-heading text-2xl font-bold">Prijsvoorstel aanpassen</h2></div><button type="button" onClick={onClose} className="min-h-12 min-w-12 rounded-button border border-border" aria-label="Venster sluiten"><X className="mx-auto h-5 w-5" aria-hidden="true" /></button></div>
        <div className="mt-6 rounded-panel border border-border bg-background p-4"><h3 className="font-heading text-lg font-bold">{item.ownProduct}</h3><p className="text-body-sm text-muted">{item.ownVariant} · {item.ownSku}</p><dl className="mt-4 grid grid-cols-2 gap-3"><div><dt className="text-xs text-muted">Huidige prijs</dt><dd className="font-heading text-2xl font-bold tabular-nums">{euro(item.ownPriceCents)}</dd></div><div><dt className="text-xs text-muted">Concurrent gelijk gewicht</dt><dd className="font-heading text-2xl font-bold tabular-nums">{euro(item.competitorEquivalentPriceCents)}</dd></div></dl></div>
        <div className="mt-5 rounded-panel border border-border p-4"><p className="text-xs font-bold uppercase tracking-[0.1em] text-muted">Onderbouwing</p><p className="mt-2 text-body-sm leading-relaxed text-text">{item.rationale}</p><ul className="mt-3 space-y-1 text-xs text-muted"><li>Bron: {item.competitor}, gemeten {shortDate(item.observedAt)}</li><li>Productmatch: {item.matchConfidenceScore}% zeker</li><li>Datakwaliteit: {item.dataQualityScore}%</li>{item.scenarioImpactPer100Cents !== null ? <li>{scenarioImpact(item.scenarioImpactPer100Cents)}</li> : null}</ul></div>
        <label className="mt-5 block"><span className="font-heading font-bold">Nieuwe prijs</span><div className="relative mt-2"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-bold text-muted">€</span><input type="text" inputMode="decimal" value={target} onChange={(event) => setTarget(event.target.value)} className="min-h-12 w-full rounded-button border border-border bg-background pl-8 pr-4 text-base font-bold tabular-nums outline-none focus:border-border-hover" /></div><span className={cn("mt-2 block text-body-sm font-semibold", Math.abs(changeBps) > 1500 ? "text-red-700" : "text-muted")}>{Number.isFinite(targetCents) ? `${signedPercent(changeBps)} ten opzichte van nu` : "Vul een geldig bedrag in"}. Maximaal 15% per actie.</span></label>
        <div className="mt-5 rounded-panel border border-amber-300 bg-amber-50 p-4 text-body-sm text-amber-950"><p className="font-heading font-bold">Controleer dit buiten de scrape</p><p className="mt-1 leading-relaxed">Inkoopprijs, btw, positionering, voorraad en eventuele zakelijke prijsafspraken zijn niet volledig onderdeel van dit voorstel.</p></div>
        <label className="mt-5 flex min-h-14 cursor-pointer items-start gap-3 rounded-panel border border-border p-4"><input type="checkbox" checked={marginChecked} onChange={(event) => setMarginChecked(event.target.checked)} className="mt-0.5 h-5 w-5 accent-[#806600]" /><span><span className="block font-heading font-bold">Ik heb marge en gevolgen gecontroleerd</span><span className="block text-xs leading-relaxed text-muted">Deze bevestiging is verplicht voordat de prijs wordt aangepast.</span></span></label>
        <div className="sticky bottom-0 mt-8 grid gap-2 border-t border-border bg-surface py-4 sm:grid-cols-2"><button type="button" onClick={onClose} className="min-h-12 rounded-button border border-border px-4 font-heading font-bold">Terug naar aanpassen</button><button type="button" disabled={!valid || submitting} onClick={() => void apply()} className="min-h-12 rounded-button bg-accent px-4 font-heading font-bold text-contrast disabled:opacity-50">{submitting ? "Veilig verwerken…" : `Prijs wijzigen naar ${Number.isFinite(targetCents) ? euro(targetCents) : "—"}`}</button></div>
      </div>
    </div>
  );
}

function FilterCheck({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) { return <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-button border border-border px-3"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 accent-[#806600]" /><span className="text-body-sm font-semibold">{label}</span></label>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block min-w-0"><span className="mb-1.5 block text-body-sm font-bold text-text">{label}</span>{children}</label>; }
function HelpItem({ children }: { children: React.ReactNode }) { return <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent-ink" aria-hidden="true" /><span>{children}</span></li>; }
function EmptySmall({ text }: { text: string }) { return <p className="mt-5 rounded-card bg-background p-4 text-body-sm text-muted">{text}</p>; }
function EmptyState({ icon: Icon, title, text }: { icon: typeof Store; title: string; text: string }) { return <div className="rounded-panel border border-dashed border-border bg-surface p-8 text-center shadow-card"><Icon className="mx-auto h-8 w-8 text-accent-ink" aria-hidden="true" /><h3 className="mt-3 font-heading text-xl font-bold">{title}</h3><p className="mx-auto mt-2 max-w-xl text-body-sm leading-relaxed text-muted">{text}</p></div>; }
function QualityPill({ score, flags }: { score: number; flags: string[] }) {
  const blocked = flags.some((flag) => ["STALE", "OUT_OF_STOCK", "COMPETITOR_PROMOTION", "UNVERIFIED_PRICE_SOURCE", "SUSPECT_OUTLIER", "MISSING_PACKAGE", "UNSUPPORTED_CURRENCY"].includes(flag));
  const label = flags.includes("STALE")
    ? "Verouderd"
    : flags.includes("OUT_OF_STOCK")
      ? "Uitverkocht"
      : flags.includes("COMPETITOR_PROMOTION")
        ? "Aanbieding: controleren"
        : flags.includes("UNVERIFIED_PRICE_SOURCE")
          ? "Prijsbron controleren"
          : blocked || score < 75
            ? "Niet gebruiken"
            : score >= 85
              ? "Goed"
              : "Controleren";
  return <span className={cn("inline-flex min-h-7 items-center rounded-full px-2.5 text-[11px] font-bold", !blocked && score >= 85 ? "bg-emerald-100 text-emerald-800" : !blocked && score >= 75 ? "bg-amber-100 text-amber-900" : "bg-red-100 text-red-800")}>{label} {score}%</span>;
}
function Difference({ value }: { value: number }) { const higher = value > 0; const neutral = Math.abs(value) < 800; return <span className={cn("inline-flex min-h-8 items-center gap-1 rounded-full px-2.5 text-xs font-bold tabular-nums", neutral ? "bg-slate-100 text-slate-700" : higher ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800")}>{neutral ? <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" /> : higher ? <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" /> : <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />}{signedPercent(value)} {higher ? "duurder" : value < 0 ? "goedkoper" : "gelijk"}</span>; }
function euro(cents: number): string { return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(cents / 100); }
function signedPercent(bps: number): string { const value = bps / 100; return `${value > 0 ? "+" : ""}${value.toLocaleString("nl-NL", { maximumFractionDigits: 1 })}%`; }
function scenarioImpact(cents: number): string { return `${euro(Math.abs(cents))} ${cents >= 0 ? "meer" : "minder"} omzet bij 100 verkochte verpakkingen; geen winstprognose.`; }
function shortDate(value: string): string { return new Intl.DateTimeFormat("nl-NL", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)); }
function isActionableRecommendation(item: PriceMonitorComparisonView): boolean {
  return Boolean(
    item.safeForAnalysis &&
    item.recommendationId &&
    item.recommendationStatus === "OPEN" &&
    item.suggestedPriceCents !== null &&
    (item.recommendationType === "LOWER" || item.recommendationType === "RAISE")
  );
}
function freshnessLabel(dashboard: PriceMonitorDashboard): string { const dates = dashboard.sources.flatMap((source) => source.lastRunAt ? [source.lastRunAt] : []).sort(); return dates.length ? `Laatste prijsronde: ${shortDate(dates[dates.length - 1])}` : "Nog geen volledige prijsronde uitgevoerd"; }
async function responseError(response: Response): Promise<string> { const body = await response.json().catch(() => null) as { error?: string } | null; return body?.error || `HTTP_${response.status}`; }
function messageForError(cause: unknown): string {
  const code = cause instanceof Error ? cause.message : "INTERNAL_ERROR";
  const messages: Record<string, string> = {
    SOURCE_NEEDS_SETUP: "Deze webshopkoppeling is nog niet klaar. Voeg eerst het bijbehorende script toe.",
    SOURCE_PAUSED: "Deze webshopkoppeling staat gepauzeerd. Zet haar eerst weer aan.",
    SOURCE_RUN_ALREADY_ACTIVE: "Voor deze webshop loopt al een prijsronde. Wacht tot die klaar is.",
    SCRAPE_FAILED: "De webshop kon nu niet betrouwbaar worden gelezen. Er is niets aan productprijzen veranderd.",
    APEX_LOCAL_FILE_SIZE: "Kies een JSON-bestand dat niet leeg en niet groter dan 20 MB is.",
    APEX_LOCAL_FILE_JSON: "Dit bestand bevat geen geldige APEX-JSON.",
    APEX_LOCAL_FILE_DOMAIN: "Dit resultaat hoort niet bij de webshop die je hierboven hebt gekozen.",
    APEX_LOCAL_FILE_FORMAT: "Het lokale APEX-resultaat heeft niet het verwachte veilige formaat.",
    APEX_DOMAIN_NOT_ALLOWED: "Kies een webshop die in de vaste APEX-lijst staat.",
    APEX_RUN_ALREADY_ACTIVE: "Voor deze webshop wacht de prijsmonitor al op een lokale APEX-run. Rond die eerst af of wacht maximaal 30 minuten.",
    APEX_UPLOAD_TOKEN_INVALID: "De tijdelijke APEX-opdracht is ongeldig of verlopen. Maak een nieuwe automatische opdracht.",
    APEX_UPLOAD_MISMATCH: "Dit resultaat hoort niet bij de aangemaakte APEX-opdracht.",
    RUN_NOT_FOUND: "Deze lokale APEX-opdracht bestaat niet meer. Maak een nieuwe opdracht.",
    RUN_ALREADY_HANDLED: "Deze lokale APEX-opdracht is al verwerkt. Maak voor een nieuwe meting een nieuwe opdracht.",
    MATCH_NOT_APPROVED: "Controleer en keur de productkoppeling eerst goed.",
    RECOMMENDATION_NOT_ACTIONABLE: "Dit is uitleg of een behoudadvies en daarom geen uitvoerbare prijsactie.",
    RECOMMENDATION_STALE_BASELINE: "Dit voorstel hoort nog bij een oudere eigen prijs. Laat de Prijscoach het opnieuw berekenen.",
    STALE_OBSERVATION: "Deze concurrentieprijs is ouder dan 48 uur. Start eerst een nieuwe prijsronde.",
    UNSAFE_SOURCE_DATA: "De brongegevens zijn niet betrouwbaar genoeg voor een prijsactie.",
    STALE_PRICE: "De huidige productprijs is intussen gewijzigd. Open het voorstel opnieuw.",
    MARGIN_CHECK_REQUIRED: "Bevestig eerst dat je marge en gevolgen hebt gecontroleerd.",
    PRICE_UNCHANGED: "Kies een ander bedrag dan de huidige prijs.",
    CHANGE_TOO_LARGE: "Deze wijziging is groter dan 15%. Pas het bedrag aan of wijzig het product handmatig.",
    ACTIVE_SALE_PRICE: "Dit product heeft een actieve aanbiedingsprijs. De Prijscoach overschrijft die niet.",
    INVALID_ORIGIN: "De beveiligingscontrole van deze aanvraag is mislukt. Vernieuw de pagina en probeer opnieuw.",
    UNAUTHORIZED: "Je adminsessie is verlopen. Log opnieuw in.",
    VALIDATION_ERROR: "Controleer de ingevulde gegevens.",
    INTERNAL_ERROR: "Er ging iets mis. Je gegevens en productprijzen zijn niet stil aangepast.",
  };
  return messages[code] || `De actie kon niet worden afgerond (${code}).`;
}
