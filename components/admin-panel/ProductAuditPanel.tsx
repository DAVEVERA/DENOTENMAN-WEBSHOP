"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Check, Languages, RefreshCw, SearchCheck, ShieldCheck, Sparkles } from "lucide-react";
import type {
  AuditArea,
  AuditLocale,
  DeterministicProductAudit,
  ProductContentProposal,
  ProductContentProposalSet,
} from "@/lib/product-audit-core";
import type { RenderedProductPageAudit } from "@/lib/rendered-product-page-audit";

type AuditWithConfiguration = DeterministicProductAudit & {
  aiConfigured: boolean;
  renderedPages: RenderedProductPageAudit[];
};

const areaLabels: Record<"overall" | AuditArea, string> = {
  overall: "Totaal",
  seo: "SEO",
  content: "Content",
  language: "Taal",
  translations: "Vertalingen",
  commerce: "Productpagina",
};

const statusLabels = {
  complete: "Compleet",
  incomplete: "Onvolledig",
  copied_from_nl: "NL-kopie gevonden",
  missing: "Ontbreekt",
} as const;

const localeLabels: Record<AuditLocale, string> = {
  nl: "Nederlands",
  en: "Engels",
  fr: "Frans",
};

function scoreClass(score: number): string {
  if (score >= 85) return "text-emerald-700";
  if (score >= 65) return "text-amber-700";
  return "text-red-700";
}

function ProposalField({
  label,
  current,
  proposed,
  html = false,
}: {
  label: string;
  current: string;
  proposed: string;
  html?: boolean;
}) {
  return (
    <div className="grid gap-3 border-t border-border py-4 lg:grid-cols-2">
      <div>
        <p className="text-caption font-semibold uppercase tracking-wide text-muted">Huidig · {label}</p>
        <div className="mt-1 whitespace-pre-wrap text-body-sm text-muted">{current || "Niet ingevuld"}</div>
      </div>
      <div>
        <p className="text-caption font-semibold uppercase tracking-wide text-accent-hover">Voorstel · {label}</p>
        {html
          ? <div className="prose prose-sm mt-1 max-w-none text-text" dangerouslySetInnerHTML={{ __html: proposed }} />
          : <div className="mt-1 whitespace-pre-wrap text-body-sm text-text">{proposed}</div>}
      </div>
    </div>
  );
}

function ProposalCard({
  proposal,
  audit,
  selected,
  onToggle,
}: {
  proposal: ProductContentProposal;
  audit: DeterministicProductAudit;
  selected: boolean;
  onToggle: () => void;
}) {
  const current = audit.translationStatus.find((item) => item.locale === proposal.locale)?.current;
  return (
    <article className="rounded-panel border border-border bg-surface shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4 sm:p-5">
        <div>
          <h3 className="font-heading text-lg font-bold text-text">{localeLabels[proposal.locale]}</h3>
          <p className="mt-1 text-caption text-muted">Bron {proposal.sourceHash.slice(0, 18)}…</p>
        </div>
        <label className="flex min-h-11 items-center gap-2 rounded-button border border-border px-3 text-body-sm font-semibold">
          <input type="checkbox" checked={selected} disabled={!proposal.canApply} onChange={onToggle} className="h-4 w-4 accent-accent" />
          {proposal.canApply ? "Selecteren" : "Vertaling ontbreekt"}
        </label>
      </div>
      <div className="px-4 sm:px-5">
        <ProposalField label="Korte omschrijving" current={current?.shortDescription ?? ""} proposed={proposal.shortDescription} />
        <ProposalField label="Volledige omschrijving" current={current?.fullDescriptionHtml ?? ""} proposed={proposal.fullDescriptionHtml} html />
        <ProposalField label="SEO-titel" current={current?.seoTitle ?? ""} proposed={proposal.seoTitle} />
        <ProposalField label="Metaomschrijving" current={current?.metaDescription ?? ""} proposed={proposal.metaDescription} />
      </div>
      <div className="grid gap-4 border-t border-border bg-background p-4 sm:grid-cols-2 sm:p-5">
        <div>
          <h4 className="text-body-sm font-bold text-text">Waarom dit voorstel</h4>
          <ul className="mt-2 space-y-1 text-body-sm text-muted">
            {proposal.rationale.map((item) => <li key={item}>• {item}</li>)}
          </ul>
        </div>
        <div>
          <h4 className="text-body-sm font-bold text-text">Taalkundige toetsing</h4>
          {proposal.languageFindings.length
            ? <ul className="mt-2 space-y-1 text-body-sm text-muted">{proposal.languageFindings.map((finding) => <li key={finding.kind + "-" + finding.evidencePath + "-" + finding.message}>• {finding.message} <span className="text-caption">({finding.evidencePath})</span></li>)}</ul>
            : <p className="mt-2 text-body-sm text-muted">Geen afzonderlijke taalproblemen gemeld.</p>}
        </div>
      </div>
    </article>
  );
}

export function RenderedPageAuditPanel({ pages }: { pages: RenderedProductPageAudit[] }) {
  return (
    <section aria-labelledby="rendered-page-audit-title" className="rounded-panel border border-border bg-surface p-4 shadow-card sm:p-6">
      <h2 id="rendered-page-audit-title" className="flex items-center gap-2 font-heading text-xl font-bold text-text">
        <SearchCheck className="h-5 w-5 text-accent-hover" />Gerenderde storefrontcontrole
      </h2>
      <p className="mt-1 max-w-3xl text-body-sm text-muted">
        Haalt de echte publieke productpagina per taal op en controleert indexeerbaarheid, metadata, canonical, hreflang, H1 en Product structured data.
      </p>
      {pages.length ? (
        <div className="mt-5 grid gap-4 xl:grid-cols-3">
          {pages.map((page) => (
            <article key={page.locale} className="min-w-0 rounded-card border border-border bg-background p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-heading text-lg font-bold text-text">{localeLabels[page.locale]}</h3>
                  <p className="mt-1 text-caption text-muted">HTTP {page.status || "niet bereikbaar"}</p>
                </div>
                <span className={`font-heading text-2xl font-bold ${scoreClass(page.score)}`}>{page.score}</span>
              </div>
              <ul className="mt-4 space-y-2">
                {page.checks.map((check) => (
                  <li key={check.code} className="flex items-start gap-2 text-body-sm">
                    {check.passed
                      ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
                      : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />}
                    <span className="min-w-0"><strong className="text-text">{check.label}</strong><span className="block break-words text-caption text-muted">{check.detail}</span></span>
                  </li>
                ))}
              </ul>
              <a href={page.url} target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-11 items-center font-semibold text-text underline decoration-accent underline-offset-4">
                Open productpagina
              </a>
            </article>
          ))}
        </div>
      ) : <p className="mt-4 text-body-sm text-muted">Er zijn nog geen gelokaliseerde productpagina&apos;s om te controleren.</p>}
    </section>
  );
}

export function ProductAuditPanel({ productId, initialAudit }: { productId: string; initialAudit: AuditWithConfiguration }) {
  const [audit, setAudit] = useState<AuditWithConfiguration>(initialAudit);
  const [proposalSet, setProposalSet] = useState<ProductContentProposalSet | null>(null);
  const [selectedLocales, setSelectedLocales] = useState<Set<AuditLocale>>(new Set());
  const [phase, setPhase] = useState<"idle" | "generating" | "applying">("idle");
  const [error, setError] = useState<string | null>(null);
  const selectedProposals = useMemo(
    () => proposalSet?.proposals.filter((proposal) => selectedLocales.has(proposal.locale)) ?? [],
    [proposalSet, selectedLocales]
  );

  async function generate() {
    setPhase("generating");
    setError(null);
    try {
      const response = await fetch("/api/admin/products/" + productId + "/audit", { method: "POST" });
      const body = await response.json().catch(() => null) as { proposalSet?: ProductContentProposalSet; message?: string } | null;
      if (!response.ok || !body?.proposalSet) throw new Error(body?.message || "De AI-voorstellen konden niet worden gemaakt.");
      setProposalSet(body.proposalSet);
      setSelectedLocales(new Set(body.proposalSet.proposals.filter((proposal) => proposal.canApply).map((proposal) => proposal.locale)));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "De AI-voorstellen konden niet worden gemaakt.");
    } finally {
      setPhase("idle");
    }
  }

  async function refreshAudit() {
    setError(null);
    try {
      const response = await fetch("/api/admin/products/" + productId + "/audit", { method: "GET", cache: "no-store" });
      const body = await response.json().catch(() => null) as { audit?: AuditWithConfiguration; message?: string } | null;
      if (!response.ok || !body?.audit) throw new Error(body?.message || "De audit kon niet worden vernieuwd.");
      setAudit(body.audit);
      setProposalSet(null);
      setSelectedLocales(new Set());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "De audit kon niet worden vernieuwd.");
    }
  }

  async function applySelected() {
    if (!proposalSet || selectedProposals.length === 0) return;
    setPhase("applying");
    setError(null);
    try {
      const response = await fetch("/api/admin/products/" + productId + "/audit/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          protectedFactsHash: proposalSet.protectedFactsHash,
          proposals: selectedProposals.map(({ locale, sourceHash, shortDescription, fullDescriptionHtml, seoTitle, metaDescription }) => ({
            locale,
            sourceHash,
            shortDescription,
            fullDescriptionHtml,
            seoTitle,
            metaDescription,
          })),
        }),
      });
      const body = await response.json().catch(() => null) as { audit?: AuditWithConfiguration; message?: string } | null;
      if (!response.ok || !body?.audit) throw new Error(body?.message || "De voorstellen zijn niet toegepast.");
      setAudit(body.audit);
      setProposalSet(null);
      setSelectedLocales(new Set());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "De voorstellen zijn niet toegepast.");
    } finally {
      setPhase("idle");
    }
  }

  function toggleLocale(locale: AuditLocale) {
    setSelectedLocales((current) => {
      const next = new Set(current);
      if (next.has(locale)) next.delete(locale);
      else next.add(locale);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <section aria-labelledby="audit-score-title" className="rounded-panel border border-border bg-surface p-4 shadow-card sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="audit-score-title" className="flex items-center gap-2 font-heading text-xl font-bold text-text"><SearchCheck className="h-5 w-5 text-accent-hover" />Deterministische volledige pagina-audit</h2>
            <p className="mt-1 max-w-3xl text-body-sm text-muted">Deze score komt uit vaste, herhaalbare controles. AI verandert de score niet en publiceert nooit automatisch.</p>
          </div>
          <button type="button" onClick={refreshAudit} className="inline-flex min-h-11 items-center gap-2 rounded-button border border-border px-4 text-body-sm font-semibold text-text">
            <RefreshCw className="h-4 w-4" />Vernieuwen
          </button>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {(Object.keys(areaLabels) as Array<keyof typeof areaLabels>).map((area) => (
            <div key={area} className="rounded-button border border-border bg-background p-3">
              <p className="text-caption font-semibold uppercase tracking-wide text-muted">{areaLabels[area]}</p>
              <p className={"mt-1 font-heading text-2xl font-bold " + scoreClass(audit.scores[area])}>{audit.scores[area]}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="translation-title" className="rounded-panel border border-border bg-surface p-4 shadow-card sm:p-6">
        <h2 id="translation-title" className="flex items-center gap-2 font-heading text-xl font-bold text-text"><Languages className="h-5 w-5 text-accent-hover" />Vertaalstatus</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {audit.translationStatus.map((translation) => (
            <div key={translation.locale} className="rounded-button border border-border p-4">
              <div className="flex items-center justify-between gap-2">
                <strong className="text-body-sm text-text">{localeLabels[translation.locale]}</strong>
                <span className={"rounded-full px-2 py-1 text-caption font-semibold " + (translation.status === "complete" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900")}>{statusLabels[translation.status]}</span>
              </div>
              {translation.missingFields.length ? <p className="mt-2 text-caption text-muted">Mist: {translation.missingFields.join(", ")}</p> : null}
            </div>
          ))}
        </div>
      </section>

      <RenderedPageAuditPanel pages={audit.renderedPages} />

      <section aria-labelledby="findings-title" className="rounded-panel border border-border bg-surface p-4 shadow-card sm:p-6">
        <h2 id="findings-title" className="font-heading text-xl font-bold text-text">Bevindingen met bewijs</h2>
        {audit.issues.length === 0
          ? <p className="mt-3 flex items-center gap-2 text-emerald-700"><Check className="h-5 w-5" />Geen vaste controlepunten gevonden.</p>
          : <div className="mt-4 space-y-3">{audit.issues.map((issue) => (
            <div key={issue.code} className="rounded-button border border-border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <AlertTriangle className={"h-4 w-4 " + (issue.severity === "critical" ? "text-red-700" : "text-amber-700")} />
                <strong className="text-body-sm text-text">{issue.title}</strong>
                <span className="rounded-full bg-background px-2 py-1 text-caption uppercase text-muted">{areaLabels[issue.area]}</span>
              </div>
              <p className="mt-2 text-body-sm text-muted">{issue.detail}</p>
              <p className="mt-2 text-caption text-muted">Bron: {issue.evidencePaths.join(" · ")}</p>
            </div>
          ))}</div>}
      </section>

      <section aria-labelledby="ai-proposals-title" className="rounded-panel border border-accent/40 bg-surface p-4 shadow-card sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="ai-proposals-title" className="flex items-center gap-2 font-heading text-xl font-bold text-text"><Sparkles className="h-5 w-5 text-accent-hover" />OpenAI-contentvoorstellen</h2>
            <p className="mt-1 max-w-3xl text-body-sm text-muted">Maakt per taal een voorstel voor korte en volledige omschrijving, SEO-titel, metaomschrijving en taalcorrecties. Je beoordeelt en selecteert alles vóór toepassen.</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-caption font-semibold text-emerald-800"><ShieldCheck className="h-4 w-4" />Feiten beschermd</span>
        </div>
        {!audit.aiConfigured ? <p role="alert" className="mt-4 rounded-button border border-amber-300 bg-amber-50 p-3 text-body-sm text-amber-900">OPENAI_API_KEY is nog niet beschikbaar in deze runtime. De vaste audit werkt wel; AI-voorstellen vereisen de sleutel.</p> : null}
        <button type="button" onClick={generate} disabled={phase !== "idle" || !audit.aiConfigured} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-button bg-accent px-5 font-heading font-bold text-contrast disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">
          <Sparkles className="h-5 w-5" />{phase === "generating" ? "Voorstellen genereren…" : proposalSet ? "Nieuwe voorstellen genereren" : "Genereer NL/EN/FR-voorstellen"}
        </button>
      </section>

      {error ? <p role="alert" className="rounded-button border border-red-300 bg-red-50 p-4 text-body-sm text-red-800">{error}</p> : null}

      {proposalSet ? (
        <section aria-labelledby="review-title" className="space-y-4">
          <div className="rounded-panel border border-border bg-surface p-4 shadow-card sm:p-6">
            <h2 id="review-title" className="font-heading text-xl font-bold text-text">Beoordelen vóór toepassen</h2>
            <p className="mt-1 text-body-sm text-muted">Model: {proposalSet.model} · gemaakt {new Date(proposalSet.generatedAt).toLocaleString("nl-NL")}</p>
            <ul className="mt-3 space-y-1 text-body-sm text-muted">{proposalSet.overallRecommendations.map((item) => <li key={item}>• {item}</li>)}</ul>
          </div>
          {proposalSet.proposals.map((proposal) => (
            <ProposalCard key={proposal.locale} proposal={proposal} audit={audit} selected={selectedLocales.has(proposal.locale)} onToggle={() => toggleLocale(proposal.locale)} />
          ))}
          <div className="sticky bottom-4 z-20 rounded-panel border border-border bg-surface/95 p-4 shadow-card backdrop-blur sm:flex sm:items-center sm:justify-between sm:gap-4">
            <p className="text-body-sm text-muted">{selectedProposals.length} taalvoorstel(len) geselecteerd. Alleen redactionele velden worden bijgewerkt.</p>
            <button type="button" onClick={applySelected} disabled={phase !== "idle" || selectedProposals.length === 0} className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-button bg-text px-5 font-heading font-bold text-surface disabled:opacity-50 sm:mt-0 sm:w-auto">
              <Check className="h-5 w-5" />{phase === "applying" ? "Toepassen…" : "Geselecteerde voorstellen toepassen"}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
