import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin-api-auth";
import { isSameOriginMutation } from "@/lib/admin-request-security";
import { recordAudit } from "@/lib/admin-audit";
import { prisma } from "@/lib/prisma";
import { invoiceCanvasSchema } from "@/lib/invoice-template-schema";
import { getOrCreateDraftInvoiceCanvas } from "@/lib/invoice-template";

export async function PATCH(request: NextRequest) {
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (admin.role === "STAFF") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });

  const parsed = invoiceCanvasSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() }, { status: 400 });

  const draft = await getOrCreateDraftInvoiceCanvas();

  const updated = await prisma.$transaction(async (tx) => {
    const before = await tx.invoiceTemplate.findUniqueOrThrow({ where: { id: draft.templateId } });
    const row = await tx.invoiceTemplate.update({ where: { id: draft.templateId }, data: { canvas: parsed.data } });
    await recordAudit(tx, admin, "InvoiceTemplate", row.id, "UPDATE", before, row);
    return row;
  });

  return NextResponse.json({ canvas: updated.canvas });
}
