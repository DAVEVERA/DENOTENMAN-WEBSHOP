import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-auth";
import { buildProductAudit } from "@/lib/product-audit";
import { canApplyMetadataFixes, planSafeMetadataFixes } from "@/lib/ai-vindbaarheid/metadata-fixes";
import { applySafeMetadataFixes } from "./actions";

export const dynamic = "force-dynamic";

export default async function AiVindbaarheidPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string; fixed?: string }>;
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

  const { product: productId, fixed } = await searchParams;
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
  const audit = selected ? await buildProductAudit(selected.id) : null;
  const checks = audit?.renderedPages ?? [];
  const translationData = selected ? await prisma.productTranslation.findMany({
    where: { productId: selected.id },
    select: { locale: true, name: true, shortDescription: true, seoTitle: true, metaDescription: true },
  }) : [];
  const fixes = planSafeMetadataFixes(translationData);

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

      {productId && !selected ? (
        <p role="alert" className="rounded-panel border border-border p-4 text-body-sm">
          Dit product staat niet in de huidige selectie van actieve producten.
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
