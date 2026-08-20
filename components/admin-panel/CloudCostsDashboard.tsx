"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CLOUD_COST_PERIODS, type CloudCostPeriod, type CloudCostsReport } from "@/lib/cloud-costs";
import { cn } from "@/lib/cn";

type LoadingState = "loading" | "ready" | "error";

const errorMessages: Record<string, string> = {
  BILLING_EXPORT_NOT_CONFIGURED:
    "De Cloud Billing-export moet nog aan de BigQuery-dataset worden gekoppeld.",
  BILLING_EXPORT_FORBIDDEN:
    "Het webshopaccount heeft nog geen leesrechten op de factureringsdataset.",
  BILLING_EXPORT_UNAVAILABLE:
    "De factureringsdata is nog niet beschikbaar. Na het aanzetten van de export kan de eerste vulling enkele uren duren.",
  INVALID_CONFIGURATION:
    "De configuratie van de factureringsdataset bevat een ongeldige waarde.",
};

function formatMoney(value: number | undefined, currency = "EUR") {
  if (value === undefined) return "—";
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("nl-NL", { day: "2-digit", month: "short" }).format(
    new Date(`${value}T12:00:00Z`)
  );
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
  const currency = report?.currency ?? "EUR";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-heading-xl text-text">Google Cloud-kosten</h1>
          <p className="mt-2 max-w-3xl text-body-sm text-muted">
            Werkelijke gebruikskosten van de actieve Google Cloud-diensten voor de webshop,
            inclusief toegepaste credits.
          </p>
        </div>
        <div className="inline-flex w-full rounded-button border border-border bg-surface p-1 sm:w-auto" aria-label="Kostenperiode">
          {CLOUD_COST_PERIODS.map((period) => (
            <button
              key={period}
              type="button"
              onClick={() => setDays(period)}
              aria-pressed={days === period}
              className={cn(
                "min-h-11 flex-1 rounded-button px-3 text-body-sm font-semibold transition-colors sm:flex-none",
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
            <p className="font-heading font-bold">Koppeling wacht op Google Cloud-data</p>
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
            Laatste verwerkte gebruik: {new Intl.DateTimeFormat("nl-NL", {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: "Europe/Amsterdam",
            }).format(new Date(report.latestUsageAt))}. Factureringsdata loopt niet realtime binnen.
          </p>
        ) : (
          <p className="text-body-sm text-muted">Voor deze periode zijn nog geen kostenregels gevonden.</p>
        )}
      </div>

      <section aria-labelledby="cost-summary-heading">
        <h2 id="cost-summary-heading" className="sr-only">Kostensamenvatting</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard label="Bruto kosten" value={formatMoney(report?.summary.grossCost, currency)} detail={`Laatste ${days} dagen`} />
          <SummaryCard label="Credits" value={formatMoney(report?.summary.credits, currency)} detail="Kortingen en tegoeden" />
          <SummaryCard label="Netto kosten" value={formatMoney(report?.summary.netCost, currency)} detail="Na verrekening van credits" />
          <SummaryCard label="Actieve diensten" value={report ? String(report.services.length) : "—"} detail="Diensten met gebruiksregels" />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
        <section className="min-w-0 rounded-panel border border-border bg-surface p-4 shadow-card sm:p-6" aria-labelledby="daily-costs-heading">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="daily-costs-heading" className="text-heading-md text-text">Dagelijks verloop</h2>
            <span className="text-xs text-muted">Netto per dag</span>
          </div>
          <div className="mt-6 flex h-52 items-end gap-1" role="img" aria-label={`Netto Google Cloud-kosten per dag over ${days} dagen`}>
            {(report?.daily ?? Array.from({ length: days }, (_, index) => ({ date: String(index), netCost: 0 }))).map((item) => {
              const height = report ? Math.max(2, (Math.max(0, item.netCost) / maximumDailyCost) * 100) : 2;
              return (
                <div key={item.date} className="group relative flex h-full min-w-0 flex-1 items-end">
                  <div
                    className={cn("w-full rounded-t-sm", report ? "bg-accent" : "animate-pulse bg-border")}
                    style={{ height: `${height}%` }}
                    title={report ? `${formatDate(item.date)}: ${formatMoney(item.netCost, currency)}` : undefined}
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
          <details className="mt-5 border-t border-border pt-4">
            <summary className="cursor-pointer font-heading text-body-sm font-semibold text-accent-hover">Dagbedragen bekijken</summary>
            <div className="mt-3 max-h-72 overflow-auto">
              <table className="w-full text-body-sm">
                <thead className="sticky top-0 bg-surface text-left text-muted"><tr><th className="py-2">Datum</th><th className="py-2 text-right">Netto</th></tr></thead>
                <tbody>{report?.daily.map((item) => <tr key={item.date} className="border-t border-border"><td className="py-2 text-text">{formatDate(item.date)}</td><td className="py-2 text-right font-semibold text-text">{formatMoney(item.netCost, currency)}</td></tr>)}</tbody>
              </table>
            </div>
          </details>
        </section>

        <section className="min-w-0 rounded-panel border border-border bg-surface p-4 shadow-card sm:p-6" aria-labelledby="service-costs-heading">
          <h2 id="service-costs-heading" className="text-heading-md text-text">Kosten per actieve dienst</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[26rem] text-body-sm">
              <thead><tr className="border-b border-border text-left text-muted"><th className="py-3 pr-3">Dienst</th><th className="px-2 py-3 text-right">Bruto</th><th className="px-2 py-3 text-right">Credits</th><th className="py-3 pl-2 text-right">Netto</th></tr></thead>
              <tbody>
                {report?.services.map((service) => (
                  <tr key={service.id} className="border-b border-border last:border-0">
                    <td className="py-3 pr-3 font-semibold text-text">{service.name}</td>
                    <td className="px-2 py-3 text-right text-muted">{formatMoney(service.grossCost, currency)}</td>
                    <td className="px-2 py-3 text-right text-muted">{formatMoney(service.credits, currency)}</td>
                    <td className="py-3 pl-2 text-right font-semibold text-text">{formatMoney(service.netCost, currency)}</td>
                  </tr>
                ))}
                {state === "ready" && report?.services.length === 0 ? <tr><td colSpan={4} className="py-8 text-center text-muted">Geen kostenregels in deze periode.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
