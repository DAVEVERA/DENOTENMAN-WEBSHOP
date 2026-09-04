import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DiscountCreateForm } from "../../nieuw/DiscountCreateForm";

export default async function DiscountEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const discount = await prisma.discount.findUnique({ where: { id } });
  if (!discount) notFound();

  return (
    <div>
      <Link href="/admin/kortingen" className="inline-flex min-h-11 items-center text-body-sm font-semibold text-accent-hover underline underline-offset-4">
        ← Terug naar kortingen
      </Link>
      <div className="mt-3">
        <h1 className="text-heading-xl text-text">Kortingscode bewerken</h1>
        <p className="mt-1 text-body-sm text-muted">Pas voorwaarden en gebruik per klant aan. Opslaan activeert de code niet automatisch.</p>
      </div>
      <div className="mt-8">
        <DiscountCreateForm initial={{
          ...discount,
          startsAt: discount.startsAt?.toISOString() ?? null,
          endsAt: discount.endsAt?.toISOString() ?? null,
        }} />
      </div>
    </div>
  );
}
