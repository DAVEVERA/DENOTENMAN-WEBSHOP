"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CLOUD_COST_PERIODS, type CloudCostPeriod, type CloudCostsReport } from "@/lib/cloud-costs";
import { cn } from "@/lib/cn";

type LoadingState = "loading" | "ready" | "error";

const errorMessages: Record<string, string> = {
  BILLING_EXPORT_NOT_CONFIGURED:
    "De Cloud Billing-export moet nog aan een BigQuery-dataset worden gekoppeld.",
  BILLING_EXPORT_FORBIDDEN:
    "Het webshopaccount heeft nog geen leesrechten op de factureringsdataset.",
  BILLING_EXPORT_UNAVAILABLE:
    "De factureringsdata is tijdelijk niet beschikbaar. Probeer het later opnieuw.",
  INVALID_CONFIGURATION:
    "De configuratie van de factureringsbronnen bevat een ongeldige waarde.",
};

export function formatCloudCostMoney(value: number | null | undefined, currency = "EUR") {
  if (value === undefined || value === null) return "Niet beschikbaar";
  const displayValue = Math.abs(value) < 0.00005 ? 0 : value;
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(displayValue);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("nl-NL", { day: "2-digit", month: "short" }).format(
    new Date(`${value}T12:00:00Z`)
  );
}

function formatDateTime(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Amsterdam",
  }).format(new Date(value));
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-panel border border-border bg-surface p-4 shadow-card sm:p-5">
      <p className="text-body-sm text-muted">{label}</p>
      <p className="mt-1 font-heading text-heading-lg font-bold text-text">{value}</p>
      <p className="mt-1 text-xs text-muted">{detail}</p>
    </div>
  );
}

export function CloudCostsDashboard() {
  const [days, setDays] = useState<CloudCostPeriod>(30);
  const [state, setState] = useState<LoadingState>("loading");
  const [report, setReport] = useState<CloudCostsReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (period: CloudCostPeriod, signal?: AbortSignal) => {
    setState("loading");
    setError(null);
    try {
      const response = await fetch(`/api/admin/cloud-costs?days=${period}`, {
        cache: "no-store",
        signal,
      });
      const body = (await response.json()) as CloudCostsReport | { error?: string };
      if (!response.ok || !("summary" in body)) {
        const code = "error" in body && body.error ? body.error : "BILLING_EXPORT_UNAVAILABLE";
        throw new Error(code);
      }
      setReport(body);
      setState("ready");
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      const code = cause instanceof Error ? cause.message : "BILLING_EXPORT_UNAVAILABLE";
      setError(errorMessages[code] ?? errorMessages.BILLING_EXPORT_UNAVAILABLE);
      setState("error");
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(days, controller.signal);
    return () => controller.abort();
  }, [days, load]);

  const maximumDailyCost = useMemo(
    () => Math.max(0.01, ...(report?.daily.map((item) => Math.max(0, item.netCost)) ?? [])),
    [report]
  );
  const accountNames = useMemo(
    () => new Map(report?.accounts.map((account) => [account.id, account.displayName]) ?? []),
    [report]
  );
  const currency = report?.currency ?? "EUR";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-heading-xl text-text">Google Cloud-kosten</h1>
          <p className="mt-2 max-w-3xl text-body-sm text-muted">
            Werkelijk gefactureerde kosten uit de Google Cloud Billing-export, uitgesplitst per
            billingaccount, project en dienst. Accounts zonder export worden gemarkeerd en niet als
            € 0 weergegeven.
          </p>
        </div>
        <div
          className="inline-flex w-full rounded-button border border-border bg-surface p-1 lg:w-auto"
          aria-label="Kostenperiode"
        >
          {CLOUD_COST_PERIODS.map((period) => (
            <button
              key={period}
              type="button"
              onClick={() => setDays(period)}
              aria-pressed={days === period}
              className={cn(
                "min-h-11 flex-1 rounded-button px-3 text-body-sm font-semibold transition-colors lg:flex-none",
                days === period ? "bg-accent text-contrast" : "text-text hover:bg-background"
              )}
            >
              {period} dagen
            </button>
          ))}
        </div>
      </div>

      <div aria-live="polite">
        {state === "error" ? (
          <div className="rounded-panel border border-amber-300 bg-amber-50 p-4 text-body-sm text-amber-950">
            <p className="font-heading font-bold">Google Cloud-kosten niet beschikbaar</p>
            <p className="mt-1">{error}</p>
            <button
              type="button"
              onClick={() => void load(days)}
              className="mt-3 min-h-11 rounded-button border border-amber-500 px-4 font-semibold"
            >
              Opnieuw controleren
            </button>
          </div>
        ) : state === "loading" ? (
          <p className="text-body-sm text-muted">Kosten worden opgehaald…</p>
        ) : report?.latestUsageAt ? (
          <p className="text-body-sm text-muted">
            Laatste verwerkte kostenregel: {formatDateTime(report.latestUsageAt)}. Billingdata loopt
            niet realtime binnen.
          </p>
        ) : (
          <p className="text-body-sm text-muted">Voor deze periode zijn geen kostenregels gevonden.</p>
        )}
      </div>

      {report && report.coverage.accountsWithoutExport > 0 ? (
        <div className="rounded-panel border border-amber-300 bg-amber-50 p-4 text-body-sm text-amber-950">
          <p className="font-heading font-bold">Niet alle accounts leveren kostendata</p>
          <p className="mt-1">
            Voor {report.coverage.accountsWithoutExport} van de {report.coverage.totalAccounts}{" "}
            billingaccounts is geen toegankelijke export gevonden. De totalen hieronder omvatten
            uitsluitend de {report.coverage.accountsWithExport} gecontroleerde export
            {report.coverage.accountsWithExport === 1 ? "" : "s"}; ontbrekende bedragen worden niet
            als nul meegeteld.
          </p>
        </div>
      ) : null}

      <section aria-labelledby="cost-summary-heading">
        <h2 id="cost-summary-heading" className="sr-only">Kostensamenvatting</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            label="Lijstkosten"
            value={formatCloudCostMoney(report?.summary.grossCost, currency)}
            detail={`Laatste ${days} dagen, beschikbare exports`}
          />
          <SummaryCard
            label="Kortingen en verschil"
            value={formatCloudCostMoney(report?.summary.credits, currency)}
            detail="Verschil tussen lijst- en factuurkosten"
          />
          <SummaryCard
            label="Werkelijk gefactureerd"
            value={formatCloudCostMoney(report?.summary.netCost, currency)}
            detail="Google Cloud BilledCost"
          />
          <SummaryCard
            label="Datadekking"
            value={report ? `${report.coverage.accountsWithExport}/${report.coverage.totalAccounts}` : "—"}
            detail="Billingaccounts met export"
          />
        </div>
      </section>

      <section
        className="rounded-panel border border-border bg-surface p-4 shadow-card sm:p-6"
        aria-labelledby="billing-accounts-heading"
      >
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="billing-accounts-heading" className="text-heading-md text-text">Alle billingaccounts</h2>
            <p className="mt-1 text-xs text-muted">
              {report?.accountDiscovery === "LIVE"
                ? "Live opgehaald via Google Cloud Billing."
                : report?.accountDiscovery === "CONFIGURED"
                  ? "Accountlijst uit de gecontroleerde configuratiefallback."
                  : "Alleen accounts die in een export zijn aangetroffen."}
            </p>
          </div>
          <span className="text-xs text-muted">Bedragen over {days} dagen</span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {report?.accounts.map((account) => (
            <article key={account.id} className="min-w-0 rounded-panel border border-border bg-background p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-heading font-bold text-text">{account.displayName}</h3>
                  <p className="mt-1 break-all font-mono text-xs text-muted">{account.id}</p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-1 text-xs font-semibold",
                    account.open ? "bg-emerald-100 text-emerald-900" : "bg-zinc-200 text-zinc-700"
                  )}
                >
                  {account.open ? "Open" : "Gesloten"}
                </span>
              </div>
              {account.costStatus === "AVAILABLE" ? (
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Werkelijke exportkosten</p>
                  <p className="mt-1 font-heading text-heading-lg font-bold text-text">
                    {formatCloudCostMoney(account.netCost, account.currency)}
                  </p>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div><dt className="text-muted">Lijstkosten</dt><dd className="font-semibold text-text">{formatCloudCostMoney(account.grossCost, account.currency)}</dd></div>
                    <div><dt className="text-muted">Projecten</dt><dd className="font-semibold text-text">{account.projectCount}</dd></div>
                  </dl>
                  <p className="mt-3 text-xs text-muted">
                    Laatste regel: {formatDateTime(account.latestUsageAt) ?? "geen kosten in deze periode"}
                  </p>
                </div>
              ) : (
                <div className="mt-4 rounded-button bg-amber-50 p-3 text-xs text-amber-950">
                  <p className="font-semibold">Geen controleerbare Billing Export</p>
                  <p className="mt-1">Een werkelijk bedrag is daarom niet beschikbaar en wordt bewust niet als € 0 getoond.</p>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
        <section className="min-w-0 rounded-panel border border-border bg-surface p-4 shadow-card sm:p-6" aria-labelledby="daily-costs-heading">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="daily-costs-heading" className="text-heading-md text-text">Dagelijks verloop</h2>
            <span className="text-xs text-muted">Werkelijk gefactureerd per dag</span>
          </div>
          <div className="mt-6 flex h-52 items-end gap-1" role="img" aria-label={`Werkelijk gefactureerde Google Cloud-kosten per dag over ${days} dagen`}>
            {(report?.daily ?? Array.from({ length: days }, (_, index) => ({ date: String(index), netCost: 0 }))).map((item) => {
              const height = report ? Math.max(2, (Math.max(0, item.netCost) / maximumDailyCost) * 100) : 2;
              return (
                <div key={item.date} className="group relative flex h-full min-w-0 flex-1 items-end">
                  <div
                    className={cn("w-full rounded-t-sm", report ? "bg-accent" : "animate-pulse bg-border")}
                    style={{ height: `${height}%` }}
                    title={report ? `${formatDate(item.date)}: ${formatCloudCostMoney(item.netCost, currency)}` : undefined}
                  />
                </div>
              );
            })}
          </div>
          {report?.daily.length ? (
            <div className="mt-2 flex justify-between text-xs text-muted">
              <span>{formatDate(report.daily[0].date)}</span>
              <span>{formatDate(report.daily[report.daily.length - 1].date)}</span>
            </div>
          ) : null}
        </section>

        <section className="min-w-0 rounded-panel border border-border bg-surface p-4 shadow-card sm:p-6" aria-labelledby="service-costs-heading">
          <h2 id="service-costs-heading" className="text-heading-md text-text">Kosten per dienst</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[26rem] text-body-sm">
              <thead><tr className="border-b border-border text-left text-muted"><th className="py-3 pr-3">Dienst</th><th className="px-2 py-3 text-right">Lijst</th><th className="px-2 py-3 text-right">Verschil</th><th className="py-3 pl-2 text-right">Factuur</th></tr></thead>
              <tbody>
                {report?.services.map((service) => (
                  <tr key={service.id} className="border-b border-border last:border-0">
                    <td className="py-3 pr-3 font-semibold text-text">{service.name}</td>
                    <td className="px-2 py-3 text-right text-muted">{formatCloudCostMoney(service.grossCost, currency)}</td>
                    <td className="px-2 py-3 text-right text-muted">{formatCloudCostMoney(service.credits, currency)}</td>
                    <td className="py-3 pl-2 text-right font-semibold text-text">{formatCloudCostMoney(service.netCost, currency)}</td>
                  </tr>
                ))}
                {state === "ready" && report?.services.length === 0 ? <tr><td colSpan={4} className="py-8 text-center text-muted">Geen kostenregels in deze periode.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="rounded-panel border border-border bg-surface p-4 shadow-card sm:p-6" aria-labelledby="project-costs-heading">
        <h2 id="project-costs-heading" className="text-heading-md text-text">Kosten per project</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[42rem] text-body-sm">
            <thead><tr className="border-b border-border text-left text-muted"><th className="py-3 pr-3">Project</th><th className="px-2 py-3">Billingaccount</th><th className="px-2 py-3 text-right">Lijst</th><th className="px-2 py-3 text-right">Verschil</th><th className="py-3 pl-2 text-right">Factuur</th></tr></thead>
            <tbody>
              {report?.projects.map((project) => (
                <tr key={`${project.billingAccountId}:${project.id}`} className="border-b border-border last:border-0">
                  <td className="py-3 pr-3"><p className="font-semibold text-text">{project.name}</p><p className="font-mono text-xs text-muted">{project.id}</p></td>
                  <td className="px-2 py-3 text-muted">{accountNames.get(project.billingAccountId) ?? project.billingAccountId}</td>
                  <td className="px-2 py-3 text-right text-muted">{formatCloudCostMoney(project.grossCost, currency)}</td>
                  <td className="px-2 py-3 text-right text-muted">{formatCloudCostMoney(project.credits, currency)}</td>
                  <td className="py-3 pl-2 text-right font-semibold text-text">{formatCloudCostMoney(project.netCost, currency)}</td>
                </tr>
              ))}
              {state === "ready" && report?.projects.length === 0 ? <tr><td colSpan={5} className="py-8 text-center text-muted">Geen projectkosten in deze periode.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
