import Link from "next/link";
import { notFound } from "next/navigation";
import { buildProductAudit } from "@/lib/product-audit";
import { ProductAuditPanel } from "@/components/admin-panel/ProductAuditPanel";

export default async function ProductAuditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const audit = await buildProductAudit(id);
  if (!audit) notFound();
  const initialAdvice = [`## Controle voor ${audit.product.name}`, "", `**Startscore: ${audit.score}/100**`, "", ...audit.issues.map((issue) => `- **${issue.title}:** ${issue.detail}`)].join("\n");
  return <div><Link href={`/admin/producten/${id}`} className="text-body-sm text-accent-hover underline underline-offset-4">← Terug naar product</Link><div className="mt-3"><h1 className="text-heading-xl text-text">AI, SEO en vindbaarheid</h1><p className="mt-2 max-w-3xl text-body-sm text-muted">Controleert productinstellingen, zoekresultaatkwaliteit, AI-leesbaarheid, interne verkoopkansen en advertentiegereedheid. Adviezen zijn aanbevelingen; publicatie blijft altijd handmatig.</p></div><div className="mt-7"><ProductAuditPanel productId={id} initialAdvice={initialAdvice} /></div></div>;
}
