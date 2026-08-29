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
  Download,
  FileJson,
  HelpCircle,
  Info,
  Mail,
  Play,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Store,
  X,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type {
  PriceMonitorComparisonView,
  PriceMonitorDashboard,
} from "@/lib/price-monitor/types";

type Tab = "overview" | "compare" | "actions" | "reports" | "help";

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Overzicht" },
  { id: "compare", label: "Vergelijken" },
  { id: "actions", label: "Acties" },
  { id: "reports", label: "Rapporten" },
  { id: "help", label: "Uitleg" },
];

const onboarding = [
  ["Kies de winkels", "Kies welke webshops je wilt bekijken. Iedere winkel heeft zijn eigen veilige koppeling."],
  ["Start de prijsronde", "Klik op Start proefronde. We beginnen bewust met maximaal 25 producten."],
  ["Wij maken prijzen vergelijkbaar", "Een zak van 250 gram en een zak van 1 kilo rekenen we om naar dezelfde prijs per kilo."],
  ["Controleer wat niet duidelijk is", "Zijn product of gewicht niet zeker? Dan vragen we jou eerst om de koppeling goed te keuren."],
  ["Bekijk opvallende verschillen", "Je ziet waar wij duidelijk duurder of goedkoper zijn, inclusief bron en meetmoment."],
  ["Bekijk het prijsvoorstel", "De Prijscoach maakt een voorzichtige conceptsuggestie. Er verandert nog niets."],
  ["Pas aan en bevestig", "Je mag het bedrag aanpassen. Alleen na jouw margecontrole en bevestiging wordt de prijs gewijzigd."],
  ["Download of ontvang een rapport", "Download Excel/CSV of JSON, print als PDF of ontvang automatisch een samenvatting per e-mail."],
] as const;

export function PriceMonitorWorkspace({
  initialDashboard,
  canWrite,
}: {
  initialDashboard: PriceMonitorDashboard;
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

  const refresh = async () => {
    const response = await fetch("/api/admin/price-monitor", { cache: "no-store" });
    if (!response.ok) throw new Error(await responseError(response));
    const nextDashboard = (await response.json()) as PriceMonitorDashboard;
    setDashboard(nextDashboard);
    return nextDashboard;
  };

  const runSource = async (sourceKey: string) => {
    setBusy(`run:${sourceKey}`);
    setError(null);
    setNotice("De prijsronde draait op de achtergrond. Je mag intussen andere onderdelen bekijken.");
    try {
      const response = await fetch("/api/admin/price-monitor/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceKey, limit: 25 }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      await response.json();
      for (let attempt = 0; attempt < 120; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 1_500));
        const nextDashboard = await refresh();
        const source = nextDashboard.sources.find((item) => item.key === sourceKey);
        if (source?.lastRunStatus === "FAILED") throw new Error("SCRAPE_FAILED");
        if (source?.lastRunStatus === "SUCCEEDED" || source?.lastRunStatus === "PARTIAL") {
          setNotice(
            source.lastRunStatus === "PARTIAL"
              ? "De prijsronde is klaar. Een paar pagina's vragen aandacht; betrouwbare gegevens staan klaar om te controleren."
              : "De prijsronde is klaar. Controleer nu de voorgestelde productkoppelingen."
          );
          setTab("compare");
          return;
        }
      }
      setNotice("De prijsronde loopt nog op de achtergrond. Vernieuw later het overzicht om de uitkomst te zien.");
    } catch (cause) {
      setError(messageForError(cause));
      setNotice(null);
    } finally {
      setBusy(null);
    }
  };

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

      <nav aria-label="Onderdelen prijsmonitor" className="grid grid-cols-2 gap-2 rounded-panel border border-border bg-surface p-2 shadow-card sm:grid-cols-5">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-current={tab === item.id ? "page" : undefined}
            onClick={() => setTab(item.id)}
            className={cn(
              "min-h-12 rounded-button px-3 py-2 font-heading text-body-sm font-bold transition focus-visible:outline-none",
              item.id === "help" && "col-span-2 sm:col-span-1",
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
          busy={busy}
          canWrite={canWrite}
          onRun={runSource}
          onOpenComparisons={() => setTab("compare")}
          onOpenActions={() => setTab("actions")}
        />
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
          <span className="block text-xs text-muted">Acht eenvoudige stappen van bron tot gecontroleerde actie</span>
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
  busy,
  canWrite,
  onRun,
  onOpenComparisons,
  onOpenActions,
}: {
  dashboard: PriceMonitorDashboard;
  busy: string | null;
  canWrite: boolean;
  onRun: (key: string) => void;
  onOpenComparisons: () => void;
  onOpenActions: () => void;
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

      <section id="bronnen" aria-labelledby="sources-title" className="scroll-mt-24">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="sources-title" className="font-heading text-2xl font-bold text-text">Webshops</h2>
            <p className="text-body-sm text-muted">Iedere webshop heeft een eigen koppeling, maar verschijnt in hetzelfde overzicht.</p>
          </div>
          <p className="text-xs font-semibold text-muted">Begin met maximaal 25 producten per proefronde</p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {dashboard.sources.map((source) => (
            <article key={source.key} className="rounded-panel border border-border bg-surface p-5 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-heading text-lg font-bold text-text">{source.name}</p>
                  <a href={source.baseUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-xs font-semibold text-accent-ink underline-offset-2 hover:underline">Bekijk webshop</a>
                </div>
                <StatusPill status={source.status} label={source.statusLabel} />
              </div>
              <p className="mt-4 min-h-16 text-body-sm leading-relaxed text-muted">{source.statusNote}</p>
              <dl className="mt-4 grid grid-cols-2 gap-3 rounded-card bg-background p-3 text-body-sm">
                <div><dt className="text-xs text-muted">Producten gezien</dt><dd className="font-bold tabular-nums text-text">{source.productsSeen}</dd></div>
                <div><dt className="text-xs text-muted">Laatste ronde</dt><dd className="font-bold text-text">{source.lastRunAt ? shortDate(source.lastRunAt) : "Nog niet"}</dd></div>
              </dl>
              <button
                type="button"
                disabled={!canWrite || !source.canRun || dashboard.setupRequired || busy !== null}
                onClick={() => onRun(source.key)}
                className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-button bg-accent px-4 font-heading font-bold text-contrast transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy === `run:${source.key}` ? <RefreshCw className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Play className="h-5 w-5" aria-hidden="true" />}
                {source.canRun ? "Start proefronde" : "Script nog koppelen"}
              </button>
            </article>
          ))}
        </div>
      </section>

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
      <article className="rounded-panel border border-accent bg-amber-50 p-5 lg:col-span-2 sm:p-6"><div className="flex items-start gap-3"><Info className="mt-0.5 h-6 w-6 shrink-0 text-accent-ink" aria-hidden="true" /><div><h2 className="font-heading text-xl font-bold">Waarom Bas Boer nog niet gestart kan worden</h2><p className="mt-1 text-body-sm leading-relaxed text-muted">De webshop is als aparte bron ingericht, maar het genoemde Bas Boer-script stond niet in deze checkout. Zodra dat bestand wordt aangeleverd, kan het als eigen adapter worden gekoppeld zonder deze pagina opnieuw te ontwerpen.</p></div></div></article>
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
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-body-sm font-bold text-text">{label}</span>{children}</label>; }
function HelpItem({ children }: { children: React.ReactNode }) { return <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent-ink" aria-hidden="true" /><span>{children}</span></li>; }
function EmptySmall({ text }: { text: string }) { return <p className="mt-5 rounded-card bg-background p-4 text-body-sm text-muted">{text}</p>; }
function EmptyState({ icon: Icon, title, text }: { icon: typeof Store; title: string; text: string }) { return <div className="rounded-panel border border-dashed border-border bg-surface p-8 text-center shadow-card"><Icon className="mx-auto h-8 w-8 text-accent-ink" aria-hidden="true" /><h3 className="mt-3 font-heading text-xl font-bold">{title}</h3><p className="mx-auto mt-2 max-w-xl text-body-sm leading-relaxed text-muted">{text}</p></div>; }
function StatusPill({ status, label }: { status: string; label: string }) { return <span className={cn("inline-flex min-h-7 shrink-0 items-center rounded-full px-2.5 text-[11px] font-bold", status === "READY" ? "bg-emerald-100 text-emerald-800" : status === "PAUSED" ? "bg-slate-200 text-slate-800" : "bg-amber-100 text-amber-900")}>{label}</span>; }
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
function messageForError(cause: unknown): string { const code = cause instanceof Error ? cause.message : "INTERNAL_ERROR"; const messages: Record<string, string> = { SOURCE_NEEDS_SETUP: "Deze webshopkoppeling is nog niet klaar. Voeg eerst het bijbehorende script toe.", SOURCE_PAUSED: "Deze webshopkoppeling staat gepauzeerd. Zet haar eerst weer aan.", SOURCE_RUN_ALREADY_ACTIVE: "Voor deze webshop loopt al een prijsronde. Wacht tot die klaar is.", SCRAPE_FAILED: "De webshop kon nu niet betrouwbaar worden gelezen. Er is niets aan productprijzen veranderd.", MATCH_NOT_APPROVED: "Controleer en keur de productkoppeling eerst goed.", RECOMMENDATION_NOT_ACTIONABLE: "Dit is uitleg of een behoudadvies en daarom geen uitvoerbare prijsactie.", RECOMMENDATION_STALE_BASELINE: "Dit voorstel hoort nog bij een oudere eigen prijs. Laat de Prijscoach het opnieuw berekenen.", STALE_OBSERVATION: "Deze concurrentieprijs is ouder dan 48 uur. Start eerst een nieuwe prijsronde.", UNSAFE_SOURCE_DATA: "De brongegevens zijn niet betrouwbaar genoeg voor een prijsactie.", STALE_PRICE: "De huidige productprijs is intussen gewijzigd. Open het voorstel opnieuw.", MARGIN_CHECK_REQUIRED: "Bevestig eerst dat je marge en gevolgen hebt gecontroleerd.", PRICE_UNCHANGED: "Kies een ander bedrag dan de huidige prijs.", CHANGE_TOO_LARGE: "Deze wijziging is groter dan 15%. Pas het bedrag aan of wijzig het product handmatig.", ACTIVE_SALE_PRICE: "Dit product heeft een actieve aanbiedingsprijs. De Prijscoach overschrijft die niet.", INVALID_ORIGIN: "De beveiligingscontrole van deze aanvraag is mislukt. Vernieuw de pagina en probeer opnieuw.", UNAUTHORIZED: "Je adminsessie is verlopen. Log opnieuw in.", VALIDATION_ERROR: "Controleer de ingevulde gegevens.", INTERNAL_ERROR: "Er ging iets mis. Je gegevens en productprijzen zijn niet stil aangepast." }; return messages[code] || `De actie kon niet worden afgerond (${code}).`; }
