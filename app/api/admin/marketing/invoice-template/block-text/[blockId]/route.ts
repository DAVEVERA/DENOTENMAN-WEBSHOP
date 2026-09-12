import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin-api-auth";
import { isSameOriginMutation } from "@/lib/admin-request-security";
import { recordAudit } from "@/lib/admin-audit";
import { prisma } from "@/lib/prisma";
import { getOrCreateDraftInvoiceCanvas } from "@/lib/invoice-template";

const bodySchema = z.object({ key: z.string().min(1).max(200), value: z.string().max(20000) }).strict();

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ blockId: string }> }) {
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (admin.role === "STAFF") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });

  const { blockId } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() }, { status: 400 });
  if (!parsed.data.key.startsWith(blockId)) return NextResponse.json({ error: "KEY_MISMATCH" }, { status: 400 });

  const draft = await getOrCreateDraftInvoiceCanvas();
  const nextBlockText = { ...draft.blockText, [parsed.data.key]: parsed.data.value };

  const updated = await prisma.$transaction(async (tx) => {
    const before = await tx.invoiceTemplate.findUniqueOrThrow({ where: { id: draft.templateId } });
    const row = await tx.invoiceTemplate.update({ where: { id: draft.templateId }, data: { blockText: nextBlockText } });
    await recordAudit(tx, admin, "InvoiceTemplate", row.id, "UPDATE", before, row);
    return row;
  });

  return NextResponse.json({ blockText: updated.blockText });
}
