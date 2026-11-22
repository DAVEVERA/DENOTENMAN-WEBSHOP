import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 30;

function explainFindings(value: unknown): Array<{ label: string; recommendation: string }> {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is { label: string; recommendation: string } =>
    Boolean(entry) && typeof entry === "object" &&
    typeof entry.label === "string" && typeof entry.recommendation === "string"
  );
}

export default async function GeoAuditHistoryPage({
  searchParams,
}: { searchParams: Promise<{ run?: string; offset?: string }> }) {
  const session = await verifyAdminSessionToken((await cookies()).get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) redirect("/admin/login");
  const admin = await prisma.adminUser.findUnique({
    where: { id: session.userId }, select: { active: true },
  });
  if (!admin?.active) redirect("/admin/login");

  const { run: runId, offset: rawOffset } = await searchParams;
  const offset = Math.min(100_000, Math.max(0, Number.isSafeInteger(Number(rawOffset)) ? Number(rawOffset) : 0));
  const runs = await prisma.geoAuditRun.findMany({
    orderBy: { startedAt: "desc" }, take: 30,
    select: { id: true, startedAt: true, status: true, scannedProducts: true, totalProducts: true },
  });
  const selectedRun = runs.find((run) => run.id === runId) ?? runs[0];
  const [count, pages] = selectedRun ? await Promise.all([
    prisma.geoAuditPage.count({ where: { runId: selectedRun.id } }),
    prisma.geoAuditPage.findMany({
      where: { runId: selectedRun.id },
      orderBy: [{ sku: "asc" }, { locale: "asc" }],
      skip: offset, take: PAGE_SIZE,
      select: {
        id: true, sku: true, locale: true, url: true, httpStatus: true,
        score: true, findings: true, checkedAt: true,
      },
    }),
  ]) : [0, []];

  return (
    <div className="space-y-6">
      <Link href="/admin/ai-vindbaarheid" className="text-body-sm text-accent-hover underline">
        Terug naar AI Vindbaarheid
      </Link>
      <div>
        <h1 className="text-heading-xl text-text">Auditgeschiedenis</h1>
        <p className="mt-2 text-body-sm text-muted">
          Bewaarde meetresultaten uit geplande storefront-scans, inclusief technische bevindingen per URL en taal.
        </p>
      </div>
      <section className="rounded-panel border border-border bg-surface p-5">
        <h2 className="font-heading text-heading-md">Auditcyclus</h2>
        {runs.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {runs.map((run) => (
              <Link key={run.id} href={`/admin/ai-vindbaarheid/geschiedenis?run=${encodeURIComponent(run.id)}`}
                aria-current={run.id === selectedRun?.id ? "page" : undefined}
                className={`rounded-button border border-border px-3 py-2 text-body-sm ${run.id === selectedRun?.id ? "font-bold text-text" : "text-muted"}`}>
                {run.startedAt.toLocaleDateString("nl-NL", { timeZone: "Europe/Amsterdam" })} · {run.status === "COMPLETED" ? "Voltooid" : "Bezig"}
              </Link>
            ))}
          </div>
        ) : <p className="mt-3 text-body-sm text-muted">Nog geen auditgeschiedenis opgeslagen.</p>}
      </section>
      {selectedRun ? (
        <section className="space-y-3">
          <h2 className="font-heading text-heading-md text-text">
            {count} opgeslagen taalpagina's · {selectedRun.scannedProducts}/{selectedRun.totalProducts} producten
          </h2>
          {pages.map((page) => {
            const findings = explainFindings(page.findings);
            return (
              <details key={page.id} className="rounded-panel border border-border bg-surface p-4">
                <summary className="cursor-pointer text-body-sm font-semibold text-text">
                  {page.sku} · {page.locale.toUpperCase()} · score {page.score}/100 · HTTP {page.httpStatus} · {findings.length} aandachtspunten
                </summary>
                <div className="mt-3 space-y-2 text-body-sm">
                  <p className="text-xs text-muted">Gemeten: {page.checkedAt.toLocaleString("nl-NL", { timeZone: "Europe/Amsterdam" })}</p>
                  <a href={page.url} target="_blank" rel="noopener noreferrer" className="break-all text-accent-hover underline">
                    Bekijk publieke pagina
                  </a>
                  {findings.length ? <ul className="space-y-2">
                    {findings.map((finding, index) => <li key={index} className="border-t border-border pt-2">
                      <strong>{finding.label}</strong><p className="text-muted">{finding.recommendation}</p>
                    </li>)}
                  </ul> : <p className="text-muted">Geen afwijkingen in de uitgevoerde checks.</p>}
                </div>
              </details>
            );
          })}
          <div className="flex flex-wrap gap-3 text-body-sm">
            {offset > 0 ? <Link href={`/admin/ai-vindbaarheid/geschiedenis?run=${selectedRun.id}&offset=${Math.max(0, offset - PAGE_SIZE)}`}
              className="rounded-button border border-border px-4 py-2">Vorige pagina</Link> : null}
            {offset + PAGE_SIZE < count ? <Link href={`/admin/ai-vindbaarheid/geschiedenis?run=${selectedRun.id}&offset=${offset + PAGE_SIZE}`}
              className="rounded-button border border-border px-4 py-2">Volgende pagina</Link> : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
