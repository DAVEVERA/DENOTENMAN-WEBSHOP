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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-heading-xl text-text">Google Cloud-kosten</h1>
          <p className="mt-2 max-w-3xl text-body-sm text-muted">
            Bekijk de totale werkelijk gefactureerde Google Cloud-kosten en het verloop per gekozen periode.
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

      <section
        className="overflow-hidden rounded-panel border border-border bg-surface shadow-card"
        aria-labelledby="nutty-bill-heading"
      >
        <div className="grid min-h-52 md:grid-cols-[minmax(0,1fr)_9rem]">
          <div className="flex flex-col justify-between p-5 sm:p-7">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-hover">Google Cloud Billing</p>
              <h2 id="nutty-bill-heading" className="mt-2 text-heading-lg text-text">the nutty bill</h2>
            </div>
            <div className="mt-8">
              <p className="text-body-sm text-muted">Werkelijk gefactureerd</p>
              <p className="mt-1 font-heading text-[clamp(2.25rem,7vw,4.75rem)] font-bold leading-none tracking-tight text-text">
                {formatCloudCostMoney(report?.summary.netCost, currency)}
              </p>
              <p className="mt-3 text-xs text-muted">Totaal over de laatste {days} dagen</p>
            </div>
          </div>
          <div
            className="hidden bg-[linear-gradient(145deg,var(--color-accent)_0_46%,transparent_46%_54%,var(--color-text)_54%_100%)] opacity-90 md:block"
            aria-hidden="true"
          />
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
              <thead><tr className="border-b border-border text-left text-muted"><th className="py-3 pr-3">Dienst</th><th className="py-3 pl-2 text-right">Werkelijke kosten</th></tr></thead>
              <tbody>
                {report?.services.map((service) => (
                  <tr key={service.id} className="border-b border-border last:border-0">
                    <td className="py-3 pr-3 font-semibold text-text">{service.name}</td>
                    <td className="py-3 pl-2 text-right font-semibold text-text">{formatCloudCostMoney(service.netCost, currency)}</td>
                  </tr>
                ))}
                {state === "ready" && report?.services.length === 0 ? <tr><td colSpan={2} className="py-8 text-center text-muted">Geen kostenregels in deze periode.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="rounded-panel border border-border bg-surface p-4 shadow-card sm:p-6" aria-labelledby="project-costs-heading">
        <h2 id="project-costs-heading" className="text-heading-md text-text">Kosten per project</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[28rem] text-body-sm">
            <thead><tr className="border-b border-border text-left text-muted"><th className="py-3 pr-3">Project</th><th className="py-3 pl-2 text-right">Werkelijke kosten</th></tr></thead>
            <tbody>
              {report?.projects.map((project) => (
                <tr key={`${project.billingAccountId}:${project.id}`} className="border-b border-border last:border-0">
                  <td className="py-3 pr-3"><p className="font-semibold text-text">{project.name}</p><p className="font-mono text-xs text-muted">{project.id}</p></td>
                  <td className="py-3 pl-2 text-right font-semibold text-text">{formatCloudCostMoney(project.netCost, currency)}</td>
                </tr>
              ))}
              {state === "ready" && report?.projects.length === 0 ? <tr><td colSpan={2} className="py-8 text-center text-muted">Geen projectkosten in deze periode.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
