import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-auth";
import { buildProductAudit } from "@/lib/product-audit";
import { canApplyMetadataFixes, metadataFixPreview, planSafeMetadataFixes } from "@/lib/ai-vindbaarheid/metadata-fixes";
import { applySafeMetadataFixes } from "./actions";
import { actionableAuditFindings } from "@/lib/ai-vindbaarheid/audit-findings";
import { runBatchAudit } from "@/lib/ai-vindbaarheid/batch-audit";
import { AiSourceResearchPanel } from "./AiSourceResearchPanel";
import { FullCatalogueAuditPanel } from "./FullCatalogueAuditPanel";
import { GeoAuditHistory } from "./GeoAuditHistory";
import { BASE_URL, product as productPath } from "@/lib/routes";
import { auditLocales } from "@/lib/product-audit-core";

export const dynamic = "force-dynamic";

export default async function AiVindbaarheidPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string; fixed?: string; stale?: string; batch?: string; offset?: string }>;
}) {
  const session = await verifyAdminSessionToken(
    (await cookies()).get(ADMIN_SESSION_COOKIE)?.value
  );
  if (!session) redirect("/admin/login");
  const admin = await prisma.adminUser.findUnique({
    where: { id: session.userId },
    select: { active: true, role: true },
  });
  if (!admin?.active) redirect("/admin/login");

  const { product: productId, fixed, stale, batch, offset } = await searchParams;
  const batchOffset = Math.max(0, Number.isSafeInteger(Number(offset)) ? Number(offset) : 0);
  const products = await prisma.product.findMany({
    where: { isActive: true, translations: { some: { locale: "nl" } } },
    select: {
      id: true,
      sku: true,
      translations: {
        where: { locale: "nl" },
        select: { name: true },
        take: 1,
      },
    },
    orderBy: { slug: "asc" },
    take: 100,
  });

  const selected = productId ? products.find((item) => item.id === productId) : undefined;
  const researchVariants = selected ? await prisma.productVariant.findMany({
    where: { productId: selected.id, isActive: true },
    select: { id: true, sku: true, weightGrams: true },
    orderBy: { weightGrams: "asc" },
  }) : [];
  const audit = selected ? await buildProductAudit(selected.id) : null;
  const checks = audit?.renderedPages ?? [];
  const findings = actionableAuditFindings(checks);
  const translationData = selected ? await prisma.productTranslation.findMany({
    where: { productId: selected.id },
    select: { locale: true, name: true, shortDescription: true, seoTitle: true, metaDescription: true },
  }) : [];
  const fixes = planSafeMetadataFixes(translationData);
  const batchProductCount = batch === "1" ? await prisma.product.count({
    where: { isActive: true, translations: { some: { locale: "nl" } } },
  }) : 0;
  // Explicitly triggered, read-only batch. Never scan the whole catalogue during page load.
  const batchProducts = batch === "1" ? await prisma.product.findMany({
    where: { isActive: true, translations: { some: { locale: "nl" } } },
    select: {
      id: true,
      sku: true,
      translations: { select: { locale: true, slug: true, name: true } },
    },
    orderBy: [{ slug: "asc" }, { id: "asc" }],
    skip: batchOffset,
    take: 6,
  }) : [];
  const batchResults = batch === "1" ? await runBatchAudit(
    batchProducts.map((item) => ({
      id: item.id,
      sku: item.sku,
      name: item.translations.find((translation) => translation.locale === "nl")?.name ?? item.sku,
      targets: item.translations
        .filter((translation) => auditLocales.some((locale) => locale === translation.locale) && translation.slug.trim() && translation.name.trim())
        .map((translation) => ({
          locale: translation.locale as (typeof auditLocales)[number],
          path: productPath(translation.locale as (typeof auditLocales)[number], translation.slug),
          productName: translation.name,
        })),
    })),
    { baseUrl: BASE_URL, concurrency: 2 }
  ) : [];
  const batchFindingCount = batchResults.reduce((sum, product) => sum + product.findings.length, 0);
  const hasMoreBatchProducts = batchOffset + batchResults.length < batchProductCount;


  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-heading-xl text-text">AI Vindbaarheid</h1>
        <p className="mt-2 max-w-3xl text-body-sm text-muted">
          Controleer de publiek toegankelijke storefront zoals een crawler die ontvangt.
          De audit hergebruikt de bestaande SEO-productcontroles. Alleen bevoegde beheerders kunnen expliciet gekozen metadata-correcties uitvoeren; alle wijzigingen worden geregistreerd.
        </p>
      </div>

      <section className="rounded-panel border border-border bg-surface p-5">
        <h2 className="font-heading text-heading-md text-text">Productpagina controleren</h2>
        <form method="get" className="mt-4 flex flex-wrap items-end gap-3">
          <label className="grid min-w-0 flex-1 gap-2 text-body-sm font-semibold" htmlFor="geo-product">
            Selecteer een product
            <select
              id="geo-product"
              name="product"
              required
              defaultValue={selected?.id ?? ""}
              className="min-h-11 w-full rounded-button border border-border bg-background px-3 text-text"
            >
              <option value="" disabled>Maak een keuze</option>
              {products.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.translations[0]?.name ?? item.sku} ({item.sku})
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="min-h-11 rounded-button bg-accent px-5 font-heading text-body-sm font-bold text-contrast">
            Analyse starten
          </button>
        </form>
        <p className="mt-3 text-xs text-muted">
          Eerste 100 actieve producten, alfabetisch op slug. Een analyse controleert de beschikbare taalversies.
        </p>
      </section>

      <GeoAuditHistory />

      {canApplyMetadataFixes(admin.role) ? <FullCatalogueAuditPanel /> : null}

      <section className="rounded-panel border border-border bg-surface p-5" aria-label="Batch-audit">
        <h2 className="font-heading text-heading-md text-text">Meerdere producten controleren</h2>
        <p className="mt-2 text-body-sm text-muted">
          Controleer per keer maximaal zes actieve producten, inclusief beschikbare NL-, EN- en FR-pagina's.
          Dit is een alleen-lezen controle; er worden geen productgegevens aangepast.
        </p>
        <form method="get" className="mt-3 flex flex-wrap items-end gap-3">
          <input type="hidden" name="batch" value="1" />
          <label className="grid gap-1 text-body-sm font-semibold" htmlFor="batch-offset">
            Start bij productnummer
            <input id="batch-offset" type="number" name="offset" min="0" step="6" defaultValue={batchOffset}
              className="min-h-11 w-36 rounded-button border border-border bg-background px-3 text-text" />
          </label>
          <button type="submit" className="min-h-11 rounded-button bg-accent px-5 font-heading text-body-sm font-bold text-contrast">
            Batch-audit uitvoeren
          </button>
        </form>
        {batch === "1" ? (
          <div className="mt-5 space-y-3">
            <p role="status" className="text-body-sm text-text">
              {batchResults.length} van {batchProductCount} producten in deze selectie verwerkt, met {batchResults.reduce((sum, product) => sum + product.pages.length, 0)} gecontroleerde taalpagina's.
              {batchFindingCount} technische aandachtspunten gevonden.
            </p>
            {batchResults.map((product) => (
              <details key={product.id} className="rounded-card border border-border p-3">
                <summary className="cursor-pointer text-body-sm font-semibold text-text">
                  {product.name} ({product.sku}) · {product.findings.length} aandachtspunten
                </summary>
                {product.findings.length ? (
                  <ul className="mt-3 space-y-2">
                    {product.findings.map((finding) => (
                      <li key={`${finding.locale}-${finding.code}`} className="text-body-sm text-muted">
                        <span className="font-semibold">{finding.priority === "hoog" ? "Hoog" : "Normaal"} · {finding.locale.toUpperCase()} · {finding.label}</span>
                        <p>{finding.recommendation}</p>
                        <a href={finding.url} target="_blank" rel="noopener noreferrer" className="break-all text-xs text-accent-hover underline">Controleer pagina</a>
                      </li>
                    ))}
                  </ul>
                ) : <p className="mt-2 text-body-sm text-muted">Geen afwijkingen binnen de uitgevoerde controles.</p>}
              </details>
            ))}
            {hasMoreBatchProducts ? (
              <Link href={`/admin/ai-vindbaarheid?batch=1&offset=${batchOffset + 6}`}
                className="inline-flex min-h-11 items-center rounded-button border border-border px-4 text-body-sm font-semibold text-text">
                Volgende zes producten
              </Link>
            ) : null}
          </div>
        ) : null}
      </section>

      {productId && !selected ? (
        <p role="alert" className="rounded-panel border border-border p-4 text-body-sm">
          Dit product staat niet in de huidige selectie van actieve producten.
        </p>
      ) : null}

      {stale === "1" && selected ? (
        <p role="alert" className="rounded-panel border border-border bg-surface p-4 text-body-sm text-text">
          Productgegevens zijn gewijzigd sinds het voorstel werd bekeken. Controleer de nieuwe voorstellen voordat je correcties toepast.
        </p>
      ) : null}

      {fixed !== undefined && selected ? (
        <p role="status" className="rounded-panel border border-border bg-surface p-4 text-body-sm text-text">
          {Number(fixed) > 0 ? `${Number(fixed)} ontbrekende metadatavelden veilig aangevuld.` : "Geen wijzigingen nodig of brongegevens zijn tussentijds gewijzigd."}
        </p>
      ) : null}

      {selected && audit ? (
        <section aria-label="Auditresultaten" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-heading text-heading-md text-text">
                {selected.translations[0]?.name ?? selected.sku}
              </h2>
              <p className="text-body-sm text-muted">Technische storefront-controle per taalversie</p>
            </div>
            <Link
              href={`/admin/producten/${selected.id}/audit`}
              className="inline-flex min-h-11 items-center rounded-button border border-border px-4 text-body-sm font-semibold text-text underline-offset-4 hover:underline"
            >
              Open uitgebreide productaudit en verbeteringen
            </Link>
          </div>
          {researchVariants.length && canApplyMetadataFixes(admin.role) ? (
            <AiSourceResearchPanel productId={selected.id} variants={researchVariants} />
          ) : null}
          <div className="rounded-panel border border-border bg-surface p-5">
            <h3 className="font-heading text-heading-md text-text">Actielijst storefront</h3>
            <p className="mt-2 text-body-sm text-muted">
              {findings.length
                ? `${findings.length} controle(s) vragen aandacht. Deze meldingen zijn gebaseerd op de ontvangen publieke HTML en moeten vóór een correctie worden geverifieerd.`
                : "Geen afwijkingen gevonden binnen de uitgevoerde technische controles. Dit is geen garantie op volledige indexering."}
            </p>
            {findings.length > 0 ? (
              <ul className="mt-4 space-y-3">
                {findings.map((finding) => (
                  <li key={`${finding.locale}-${finding.code}`} className="rounded-card border border-border p-3 text-body-sm">
                    <p className="font-semibold text-text">
                      {finding.priority === "hoog" ? "Hoge prioriteit" : "Normale prioriteit"} · {finding.locale.toUpperCase()} · {finding.label}
                    </p>
                    <p className="mt-1 text-muted">{finding.recommendation}</p>
                    <a href={finding.url} target="_blank" rel="noopener noreferrer" className="mt-1 block break-all text-xs text-accent-hover underline">
                      Te controleren storefront-URL
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <div className="rounded-panel border border-border bg-surface p-5">
            <h3 className="font-heading text-heading-md text-text">Veilige automatische correcties</h3>
            <p className="mt-2 text-body-sm text-muted">
              Alleen ontbrekende SEO-titels en metaomschrijvingen, afgeleid van bestaande productnamen en beschrijvingen.
              Bestaande handmatige velden blijven ongemoeid.
            </p>
            {fixes.length && canApplyMetadataFixes(admin.role) ? (
              <>
                <ul className="mt-3 space-y-1 text-body-sm text-text">
                  {fixes.map((fix) => (
                    <li key={`${fix.locale}-${fix.field}`}>
                      {fix.locale.toUpperCase()} · {fix.field === "seoTitle" ? "SEO-titel" : "Metaomschrijving"}: {fix.value}
                    </li>
                  ))}
                </ul>
                <form action={applySafeMetadataFixes} className="mt-4">
                  <input type="hidden" name="product" value={selected.id} />
                  <input type="hidden" name="preview" value={metadataFixPreview(fixes)} />
                  <button type="submit" className="min-h-11 rounded-button bg-accent px-5 font-heading text-body-sm font-bold text-contrast">
                    {fixes.length} veilige correcties uitvoeren
                  </button>
                </form>
              </>
             ) : <p className="mt-3 text-body-sm text-muted">{fixes.length ? "Alleen beheerders kunnen deze correcties uitvoeren." : "Geen automatisch herstelbare ontbrekende metadata gevonden."}</p>}
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {checks.map((page) => (
              <article key={page.locale} className="min-w-0 rounded-panel border border-border bg-surface p-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-heading font-bold uppercase text-text">{page.locale}</h3>
                  <span className="text-body-sm font-bold text-text">
                    {page.checks.filter((item) => item.passed).length}/{page.checks.length} controles
                  </span>
                </div>
                <a href={page.url} target="_blank" rel="noopener noreferrer" className="mt-2 block break-all text-xs text-accent-hover underline">
                  Publieke pagina openen
                </a>
                <p className="mt-2 text-xs text-muted">HTTP-status: {page.status || "niet bereikbaar"}</p>
                <div className="mt-4 space-y-3">
                  {page.checks.map((item) => (
                    <div key={item.code} className="border-t border-border pt-3">
                      <p className="text-body-sm font-semibold text-text">
                        <span aria-hidden="true">{item.passed ? "✓ " : "✕ "}</span>
                        {item.label}: {item.passed ? "in orde" : "aandacht nodig"}
                      </p>
                      {!item.passed ? (
                        <p className="mt-1 text-xs text-muted">{item.recommendation}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
          <p className="text-xs text-muted">
            Dit is een technische audit, geen meting van daadwerkelijke AI-vermeldingen of aanbevelingen.
            Resultaten zijn momentopnamen. Metadatacorrecties worden uitsluitend na gebruik van de herstelknop toegepast.
          </p>
        </section>
      ) : null}
    </div>
  );
}
