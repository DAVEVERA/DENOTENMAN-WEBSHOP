import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin-api-auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateDraftInvoiceCanvas, getPublishedInvoiceCanvas } from "@/lib/invoice-template";

export async function GET(request: NextRequest) {
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const [draft, published, hasPublished] = await Promise.all([
    getOrCreateDraftInvoiceCanvas(),
    getPublishedInvoiceCanvas(),
    prisma.invoiceTemplate.findUnique({ where: { status: "PUBLISHED" } }).then(Boolean),
  ]);

  return NextResponse.json({
    templateId: draft.templateId,
    draftCanvas: draft.canvas,
    draftBlockText: draft.blockText,
    publishedCanvas: published.canvas,
    publishedBlockText: published.blockText,
    hasPublished,
  });
}
