import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin-api-auth";
import { recordAudit } from "@/lib/admin-audit";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const draft = await prisma.invoiceTemplate.findUnique({ where: { status: "DRAFT" } });
  if (!draft) return NextResponse.json({ error: "NO_DRAFT" }, { status: 409 });

  const published = await prisma.$transaction(async (tx) => {
    const existingPublished = await tx.invoiceTemplate.findUnique({ where: { status: "PUBLISHED" } });
    if (existingPublished) await tx.invoiceTemplate.delete({ where: { id: existingPublished.id } });
    const updated = await tx.invoiceTemplate.update({
      where: { id: draft.id },
      data: { status: "PUBLISHED", publishedAt: new Date() },
    });
    await recordAudit(tx, admin, "InvoiceTemplate", updated.id, "UPDATE", draft, updated);
    return updated;
  });

  return NextResponse.json({ templateId: published.id, publishedAt: published.publishedAt });
}
