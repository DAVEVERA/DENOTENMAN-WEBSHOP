import "server-only";
import { prisma } from "@/lib/prisma";
import {
  INVOICE_TEMPLATE_BLOCK_KEYS,
  DEFAULT_INVOICE_TEMPLATE_BLOCKS,
  deriveCanvasFromLegacyContent,
  type InvoiceTemplateBlockKey,
  type InvoiceTemplateBlockLayout,
  type InvoiceCanvas,
} from "@/lib/invoice-template-schema";

function defaultLayout(key: InvoiceTemplateBlockKey): InvoiceTemplateBlockLayout {
  return { key, ...DEFAULT_INVOICE_TEMPLATE_BLOCKS[key], textOverrides: null };
}

function fillMissingKeys(
  rows: { key: string; x: number; y: number; width: number; height: number; textOverrides: unknown }[]
): InvoiceTemplateBlockLayout[] {
  const byKey = new Map(rows.map((row) => [row.key, row]));
  return INVOICE_TEMPLATE_BLOCK_KEYS.map((key) => {
    const row = byKey.get(key);
    if (!row) return defaultLayout(key);
    return {
      key,
      x: row.x,
      y: row.y,
      width: row.width,
      height: row.height,
      textOverrides: (row.textOverrides as Record<string, string> | null) ?? null,
    };
  });
}

type CanvasRecord = { templateId: string; canvas: InvoiceCanvas; blockText: Record<string, string> };

function resolveCanvas(template: {
  id: string;
  canvas: unknown;
  blockText: unknown;
  blocks: { key: string; x: number; y: number; width: number; height: number; textOverrides: unknown }[];
}): CanvasRecord {
  if (template.canvas) {
    return {
      templateId: template.id,
      canvas: template.canvas as InvoiceCanvas,
      blockText: (template.blockText as Record<string, string> | null) ?? {},
    };
  }
  const derived = deriveCanvasFromLegacyContent(fillMissingKeys(template.blocks));
  return { templateId: template.id, canvas: derived.canvas, blockText: derived.blockText };
}

export async function getPublishedInvoiceCanvas(): Promise<Omit<CanvasRecord, "templateId">> {
  const published = await prisma.invoiceTemplate.findUnique({ where: { status: "PUBLISHED" }, include: { blocks: true } });
  if (!published) {
    const derived = deriveCanvasFromLegacyContent(INVOICE_TEMPLATE_BLOCK_KEYS.map(defaultLayout));
    return derived;
  }
  const { canvas, blockText } = resolveCanvas(published);
  return { canvas, blockText };
}

export async function getOrCreateDraftInvoiceCanvas(): Promise<CanvasRecord> {
  const existingDraft = await prisma.invoiceTemplate.findUnique({ where: { status: "DRAFT" }, include: { blocks: true } });
  if (existingDraft) return resolveCanvas(existingDraft);

  const seed = await getPublishedInvoiceCanvas();
  const created = await prisma.invoiceTemplate.create({
    data: { status: "DRAFT", canvas: seed.canvas, blockText: seed.blockText },
    include: { blocks: true },
  });
  return resolveCanvas(created);
}
