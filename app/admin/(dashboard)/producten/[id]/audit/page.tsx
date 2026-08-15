import Link from "next/link";
import { notFound } from "next/navigation";
import { buildProductAudit } from "@/lib/product-audit";
import { ProductAuditPanel } from "@/components/admin-panel/ProductAuditPanel";

export default async function ProductAuditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const audit = await buildProductAudit(id);
  if (!audit) notFound();

  return (
    <div>
      <Link href={"/admin/producten/" + id} className="text-body-sm text-accent-hover underline underline-offset-4">← Terug naar product</Link>
      <div className="mt-3">
        <h1 className="text-heading-xl text-text">Productaudit · {audit.product.name}</h1>
        <p className="mt-2 max-w-3xl text-body-sm text-muted">
          Volledige vaste controle op content, SEO, Nederlandse taal, vertalingen en productpagina-instellingen.
          OpenAI levert uitsluitend voorstellen; jij kiest wat wordt toegepast.
        </p>
      </div>
      <div className="mt-7"><ProductAuditPanel productId={id} initialAudit={audit} /></div>
    </div>
  );
}
