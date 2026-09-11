import "server-only";
import { prisma } from "@/lib/prisma";
import {
  INVOICE_TEMPLATE_BLOCK_KEYS,
  DEFAULT_INVOICE_TEMPLATE_BLOCKS,
  type InvoiceTemplateBlockKey,
  type InvoiceTemplateBlockLayout,
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

export async function getPublishedInvoiceTemplateBlocks(): Promise<InvoiceTemplateBlockLayout[]> {
  const published = await prisma.invoiceTemplate.findUnique({
    where: { status: "PUBLISHED" },
    include: { blocks: true },
  });
  if (!published) return INVOICE_TEMPLATE_BLOCK_KEYS.map(defaultLayout);
  return fillMissingKeys(published.blocks);
}

export async function getOrCreateDraftInvoiceTemplate(): Promise<{
  templateId: string;
  blocks: InvoiceTemplateBlockLayout[];
}> {
  const existingDraft = await prisma.invoiceTemplate.findUnique({
    where: { status: "DRAFT" },
    include: { blocks: true },
  });
  if (existingDraft) return { templateId: existingDraft.id, blocks: fillMissingKeys(existingDraft.blocks) };

  const seedBlocks = await getPublishedInvoiceTemplateBlocks();
  const created = await prisma.invoiceTemplate.create({
    data: {
      status: "DRAFT",
      blocks: {
        create: seedBlocks.map((block) => ({
          key: block.key,
          x: block.x,
          y: block.y,
          width: block.width,
          height: block.height,
          textOverrides: block.textOverrides ?? undefined,
        })),
      },
    },
    include: { blocks: true },
  });
  return { templateId: created.id, blocks: fillMissingKeys(created.blocks) };
}
