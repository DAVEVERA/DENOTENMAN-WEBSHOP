import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { getAdminSession } from "@/lib/admin-api-auth";
import { recordAudit } from "@/lib/admin-audit";
import { prisma } from "@/lib/prisma";
import {
  INVOICE_TEMPLATE_BLOCK_KEYS,
  EDITABLE_TEXT_KEYS_BY_BLOCK,
  invoiceTemplateBlockPatchSchema,
  type InvoiceTemplateBlockKey,
} from "@/lib/invoice-template-schema";
import { getOrCreateDraftInvoiceTemplate } from "@/lib/invoice-template";

function isValidKey(value: string): value is InvoiceTemplateBlockKey {
  return (INVOICE_TEMPLATE_BLOCK_KEYS as readonly string[]).includes(value);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { key } = await params;
  if (!isValidKey(key)) return NextResponse.json({ error: "INVALID_KEY" }, { status: 400 });

  const parsed = invoiceTemplateBlockPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION_ERROR", issues: parsed.error.flatten() }, { status: 400 });

  const allowedTextKeys = EDITABLE_TEXT_KEYS_BY_BLOCK[key];
  const overrideKeys = Object.keys(parsed.data.textOverrides ?? {});
  if (overrideKeys.some((overrideKey) => !allowedTextKeys.includes(overrideKey))) {
    return NextResponse.json({ error: "INVALID_TEXT_KEY" }, { status: 400 });
  }

  const draft = await getOrCreateDraftInvoiceTemplate();

  const { textOverrides, ...rect } = parsed.data;
  const blockData = { ...rect, textOverrides: textOverrides === null ? Prisma.JsonNull : textOverrides };

  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.invoiceTemplateBlock.findUnique({ where: { templateId_key: { templateId: draft.templateId, key } } });
    const row = await tx.invoiceTemplateBlock.upsert({
      where: { templateId_key: { templateId: draft.templateId, key } },
      create: { templateId: draft.templateId, key, ...blockData },
      update: { ...blockData },
    });
    await recordAudit(tx, admin, "InvoiceTemplateBlock", row.id, existing ? "UPDATE" : "CREATE", existing, row);
    return row;
  });

  return NextResponse.json({ block: updated });
}
