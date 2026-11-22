import { prisma } from "@/lib/prisma";

function stamp(value: Date | null): string {
  return value ? new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Amsterdam",
  }).format(value) : "Nog niet beschikbaar";
}

/** Durable automated-run history. Manual one-off audits are not saved yet. */
export async function GeoAuditHistory() {
  const runs = await prisma.geoAuditRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 8,
    select: {
      id: true, status: true, trigger: true, startedAt: true, completedAt: true,
      totalProducts: true, scannedProducts: true, pagesChecked: true,
      issueCount: true, lastError: true,
    },
  });
  const latest = runs[0];
  const recentIssues = latest ? await prisma.geoAuditPage.findMany({
    where: { runId: latest.id },
    orderBy: { checkedAt: "desc" },
    take: 20,
    select: { id: true, locale: true, sku: true, url: true, httpStatus: true, score: true, findings: true },
  }) : [];
  const previous = runs.find((run) => run.status === "COMPLETED" && run.id !== latest?.id);
  const newIssues = previous && latest?.status === "COMPLETED"
    ? latest.issueCount - previous.issueCount : null;

  return (
    <section className="rounded-panel border border-border bg-surface p-5" aria-label="Auditgeschiedenis">
      <h2 className="font-heading text-heading-md text-text">Auditgeschiedenis en planning</h2>
      <p className="mt-2 text-body-sm text-muted">
        Geautomatiseerde cataloguscontroles worden per product en taal opgeslagen, met scores,
        HTTP-status, bevindingen en controletijd. De volledige scan loopt in kleine, geplande batches.
        Handmatig gestarte scans zijn momenteel nog niet opgeslagen.
      </p>
      {!latest ? <p className="mt-4 text-body-sm text-muted">Nog geen opgeslagen auditmetingen. De eerste geplande controle wordt zichtbaar zodra de scheduler is geconfigureerd en gestart.</p> : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-card border border-border p-3">
              <p className="text-xs text-muted">Laatste start</p>
              <p className="font-semibold text-text">{stamp(latest.startedAt)}</p>
              <p className="text-xs text-muted">Status: {latest.status === "COMPLETED" ? "Voltooid" : "Bezig"}</p>
            </div>
            <div className="rounded-card border border-border p-3">
              <p className="text-xs text-muted">Auditvoortgang</p>
              <p className="font-semibold text-text">{latest.scannedProducts} / {latest.totalProducts} producten</p>
              <p className="text-xs text-muted">{latest.pagesChecked} taalpagina's gecontroleerd</p>
            </div>
            <div className="rounded-card border border-border p-3">
              <p className="text-xs text-muted">Technische bevindingen</p>
              <p className="font-semibold text-text">{latest.issueCount}</p>
              <p className="text-xs text-muted">{newIssues === null ? "Trend nog niet vergelijkbaar" : `Verschil t.o.v. vorige voltooide scan: ${newIssues > 0 ? "+" : ""}${newIssues}`}</p>
            </div>
          </div>
          {latest.lastError ? <p role="alert" className="mt-3 text-body-sm text-text">Laatste fout (opnieuw te proberen): {latest.lastError}</p> : null}
          <h3 className="mt-5 font-heading font-semibold text-text">Recente auditcycli</h3>
          <ul className="mt-2 space-y-2 text-body-sm">
            {runs.map((run) => (
              <li key={run.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2">
                <span>{stamp(run.startedAt)} · {run.status === "COMPLETED" ? "Afgerond" : "Bezig"}</span>
                <span className="text-muted">{run.scannedProducts}/{run.totalProducts} producten · {run.issueCount} meldingen</span>
              </li>
            ))}
          </ul>
          {recentIssues.length ? (
            <details className="mt-4 rounded-card border border-border p-3">
              <summary className="cursor-pointer text-body-sm font-semibold text-text">
                Laatst opgeslagen pagina's ({recentIssues.length} zichtbaar)
              </summary>
              <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto text-body-sm">
                {recentIssues.map((page) => (
                  <li key={page.id} className="border-t border-border pt-2">
                    <a href={page.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent-hover underline">
                      {page.sku} · {page.locale.toUpperCase()} · {page.score}/100
                    </a>
                    <span className="ml-2 text-muted">HTTP {page.httpStatus}</span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </>
      )}
      <p className="mt-3 text-xs text-muted">
        De standaardplanning start iedere zeven dagen een nieuwe cyclus. Een ingestelde Cloud Scheduler
        roept de beveiligde route iedere vijf minuten aan tot alle producten zijn gecontroleerd.
        Er worden geen productgegevens aangepast.
      </p>
    </section>
  );
}
