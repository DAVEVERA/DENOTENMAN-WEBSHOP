import Link from "next/link";
import { getProviderStatusReport } from "@/lib/provider-status";
import { IntegrationStatusChip } from "./IntegrationStatusChip";
import { formatAmsterdamDateTime } from "@/lib/amsterdam-calendar";
import { canvaConnectionSummary } from "@/lib/canva/connection";
import { BASE_URL } from "@/lib/routes";
import { CanvaConnectionCard } from "@/components/admin-panel/canva/CanvaConnectionCard";

export const dynamic = "force-dynamic";

export default async function IntegratiesPage({ searchParams }: { searchParams: Promise<{ canva?: string }> }) {
  const [report, canva, { canva: canvaNotice }] = await Promise.all([
    getProviderStatusReport(),
    canvaConnectionSummary().catch(() => ({ configured: false, connected: false, displayName: null, connectedAt: null })),
    searchParams,
  ]);

  return (
    <div>
      <Link href="/admin/instellingen" className="font-heading text-body-sm font-semibold text-accent-hover underline underline-offset-4">
        ← Terug naar instellingen
      </Link>
      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-heading-xl text-text">Integratiestatus</h1>
          <p className="mt-1 max-w-3xl text-body-sm text-muted">
            Alleen-lezen controle van configuratie en bekende verbindingen. Sleutels, tokens, bucketnamen en account-ID&apos;s blijven afgeschermd.
          </p>
        </div>
        <p className="text-xs text-muted">
          Gecontroleerd {formatAmsterdamDateTime(report.checkedAt, "nl-NL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {report.statuses.map((provider) => (
          <section key={provider.id} className="rounded-panel border border-border bg-surface p-5 shadow-card" aria-labelledby={`provider-${provider.id}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 id={`provider-${provider.id}`} className="font-heading text-heading-sm text-text">{provider.label}</h2>
              <IntegrationStatusChip state={provider.state} label={provider.statusLabel} />
            </div>
            <p className="mt-3 text-body-sm font-semibold text-text">{provider.summary}</p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-body-sm text-muted">
              {provider.details.map((detail) => <li key={detail}>{detail}</li>)}
            </ul>
          </section>
        ))}
        <CanvaConnectionCard initial={canva} notice={canvaNotice ?? null} siteUrl={BASE_URL} returnTo="/admin/instellingen/integraties" />
      </div>

      <p className="mt-5 rounded-card border border-border bg-background p-4 text-body-sm text-muted">
        Deze pagina verstuurt geen betalingen, e-mails, labels, AI-opdrachten, uploads of social posts. Alleen PhotoRoom krijgt een niet-betalende accountcontrole om een creditsaldo te kunnen bewijzen.
      </p>
    </div>
  );
}
