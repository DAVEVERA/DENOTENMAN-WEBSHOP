import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { QuoteCreateForm } from "./QuoteCreateForm";

export default async function NewQuotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const businessAccount = await prisma.businessAccount.findUnique({ where: { id } });
  if (!businessAccount) {
    notFound();
  }

  return (
    <div>
      <Link
        href={`/admin/zakelijk/${businessAccount.id}`}
        className="text-body-sm text-accent-hover underline underline-offset-4"
      >
        ← Terug naar {businessAccount.companyName}
      </Link>
      <div className="mt-3">
        <h1 className="text-heading-xl text-text">Nieuwe offerte</h1>
        <p className="mt-1 text-body-sm text-muted">
          Stel een offerte samen voor {businessAccount.companyName}.
        </p>
      </div>
      <div className="mt-8">
        <QuoteCreateForm businessAccountId={businessAccount.id} />
      </div>
    </div>
  );
}
