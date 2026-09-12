import { z } from "zod";

export const INVOICE_TEMPLATE_BLOCK_KEYS = [
  "header",
  "sellerAddress",
  "buyerAddress",
  "metadata",
  "itemsTable",
  "totals",
  "footer",
] as const;

export type InvoiceTemplateBlockKey = (typeof INVOICE_TEMPLATE_BLOCK_KEYS)[number];

export type InvoiceTemplateBlockLayout = {
  key: InvoiceTemplateBlockKey;
  x: number;
  y: number;
  width: number;
  height: number;
  textOverrides: Record<string, string> | null;
};

type BlockRect = { x: number; y: number; width: number; height: number };

export const DEFAULT_INVOICE_TEMPLATE_BLOCKS: Record<InvoiceTemplateBlockKey, BlockRect> = {
  header: { x: 56, y: 32, width: 483, height: 110 },
  sellerAddress: { x: 56, y: 170, width: 230, height: 90 },
  buyerAddress: { x: 317, y: 170, width: 222, height: 90 },
  metadata: { x: 56, y: 270, width: 483, height: 50 },
  itemsTable: { x: 56, y: 340, width: 483, height: 360 },
  totals: { x: 355, y: 710, width: 184, height: 90 },
  footer: { x: 56, y: 808, width: 483, height: 26 },
};

export const invoiceTemplateBlockPatchSchema = z
  .object({
    x: z.number().min(0).max(842),
    y: z.number().min(0).max(842),
    width: z.number().min(20).max(842),
    height: z.number().min(20).max(842),
    textOverrides: z.record(z.string(), z.string().max(200)).nullable(),
  })
  .strict();

export const EDITABLE_TEXT_KEYS_BY_BLOCK: Record<InvoiceTemplateBlockKey, readonly string[]> = {
  header: ["title"],
  sellerAddress: [],
  buyerAddress: ["addressLabel"],
  metadata: [],
  itemsTable: ["columnDescription", "columnQuantity", "columnUnitPrice", "columnAmount"],
  totals: [],
  footer: ["thankYouLine"],
};

export const INVOICE_DATA_BLOCK_TYPES = INVOICE_TEMPLATE_BLOCK_KEYS;
export type InvoiceDataBlockType = InvoiceTemplateBlockKey;

export const INVOICE_FREE_BLOCK_TYPES = ["text", "image", "spacer", "divider", "customHtml"] as const;
export type InvoiceFreeBlockType = (typeof INVOICE_FREE_BLOCK_TYPES)[number];

export const INVOICE_BLOCK_TYPES = [...INVOICE_DATA_BLOCK_TYPES, ...INVOICE_FREE_BLOCK_TYPES] as const;
export type InvoiceBlockType = (typeof INVOICE_BLOCK_TYPES)[number];

export type InvoiceFontFamily = "SANS" | "SERIF";
export type InvoiceFontSize = "COMPACT" | "STANDAARD" | "GROOT";
export type InvoiceTextAlign = "left" | "center" | "right";

export type InvoiceDataBlock = {
  id: string;
  type: InvoiceDataBlockType;
  backgroundColor: string;
  textColor: string;
};

export type InvoiceTextBlock = {
  id: string;
  type: "text";
  font: InvoiceFontFamily;
  size: InvoiceFontSize;
  color: string;
  align: InvoiceTextAlign;
  bold: boolean;
  italic: boolean;
};

export type InvoiceImageBlock = {
  id: string;
  type: "image";
  mediaUrl: string | null;
  alt: string;
  widthPt: number;
  align: InvoiceTextAlign;
};

export type InvoiceSpacerBlock = { id: string; type: "spacer"; heightPt: number; showDivider: boolean };
export type InvoiceDividerBlock = { id: string; type: "divider"; color: string; thicknessPt: number };
export type InvoiceCustomHtmlBlock = { id: string; type: "customHtml" };

export type InvoiceBlock =
  | InvoiceDataBlock
  | InvoiceTextBlock
  | InvoiceImageBlock
  | InvoiceSpacerBlock
  | InvoiceDividerBlock
  | InvoiceCustomHtmlBlock;

export type InvoiceColumn = {
  id: string;
  widthFraction: number;
  backgroundColor: string;
  padding: number;
  blocks: InvoiceBlock[];
};

export type InvoiceRow = {
  id: string;
  backgroundColor: string;
  padding: number;
  columns: InvoiceColumn[];
};

export type InvoiceCanvas = { rows: InvoiceRow[] };

/** Key a block's text/HTML content lives under in the flat blockText map.
 * Free blocks (one content string) call blockTextKey(id); data-bound
 * blocks (several override fields) call blockTextKey(id, field). */
export function blockTextKey(blockId: string, field?: string): string {
  return field ? `${blockId}:${field}` : blockId;
}

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Verwacht een hex-kleur, bv. #e0b200");

const invoiceDataBlockSchema = z.object({
  id: z.string().min(1),
  type: z.enum(INVOICE_DATA_BLOCK_TYPES),
  backgroundColor: hexColor,
  textColor: hexColor,
}).strict();

const invoiceTextBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal("text"),
  font: z.enum(["SANS", "SERIF"]),
  size: z.enum(["COMPACT", "STANDAARD", "GROOT"]),
  color: hexColor,
  align: z.enum(["left", "center", "right"]),
  bold: z.boolean(),
  italic: z.boolean(),
}).strict();

const invoiceImageBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal("image"),
  mediaUrl: z.string().url().nullable(),
  alt: z.string().max(200),
  widthPt: z.number().min(10).max(483),
  align: z.enum(["left", "center", "right"]),
}).strict();

const invoiceSpacerBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal("spacer"),
  heightPt: z.number().min(1).max(400),
  showDivider: z.boolean(),
}).strict();

const invoiceDividerBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal("divider"),
  color: hexColor,
  thicknessPt: z.number().min(0.5).max(10),
}).strict();

const invoiceCustomHtmlBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal("customHtml"),
}).strict();

const invoiceBlockSchema = z.union([
  invoiceDataBlockSchema,
  invoiceTextBlockSchema,
  invoiceImageBlockSchema,
  invoiceSpacerBlockSchema,
  invoiceDividerBlockSchema,
  invoiceCustomHtmlBlockSchema,
]);

const invoiceColumnSchema = z.object({
  id: z.string().min(1),
  widthFraction: z.number().min(0.05).max(1),
  backgroundColor: hexColor,
  padding: z.number().min(0).max(100),
  blocks: z.array(invoiceBlockSchema).max(30),
}).strict();

const invoiceRowSchema = z.object({
  id: z.string().min(1),
  backgroundColor: hexColor,
  padding: z.number().min(0).max(100),
  columns: z.array(invoiceColumnSchema).min(1).max(4),
}).strict();

export const invoiceCanvasSchema = z.object({
  rows: z.array(invoiceRowSchema).max(60),
}).strict().superRefine((canvas, ctx) => {
  const dataBlockTypeCounts = new Map<string, number>();
  for (const row of canvas.rows) {
    for (const column of row.columns) {
      for (const block of column.blocks) {
        if ((INVOICE_DATA_BLOCK_TYPES as readonly string[]).includes(block.type)) {
          dataBlockTypeCounts.set(block.type, (dataBlockTypeCounts.get(block.type) ?? 0) + 1);
        }
      }
    }
    const widthSum = row.columns.reduce((sum, column) => sum + column.widthFraction, 0);
    if (Math.abs(widthSum - 1) > 0.02) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Rij ${row.id}: kolombreedtes tellen niet op tot 1 (${widthSum.toFixed(2)})` });
    }
  }
  for (const [type, count] of dataBlockTypeCounts) {
    if (count > 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Bloktype ${type} komt vaker dan één keer voor` });
    }
  }
});

function invoiceColumn(id: string, blocks: InvoiceBlock[]): InvoiceColumn {
  return { id, widthFraction: 1, backgroundColor: "#ffffff", padding: 0, blocks };
}

function invoiceRow(id: string, columns: InvoiceColumn[]): InvoiceRow {
  return { id, backgroundColor: "#ffffff", padding: 0, columns };
}

/** One row per legacy block, in INVOICE_TEMPLATE_BLOCK_KEYS order, each a
 * single full-width column holding that block's data-bound equivalent.
 * Every legacy textOverrides entry moves into the flat blockText map under
 * blockTextKey(key, overrideField) — the block's stable id is its legacy
 * key, so a template migrated once and never re-saved keeps stable ids
 * across repeated reads. */
export function deriveCanvasFromLegacyContent(
  blocks: InvoiceTemplateBlockLayout[]
): { canvas: InvoiceCanvas; blockText: Record<string, string> } {
  const byKey = new Map(blocks.map((block) => [block.key, block]));
  const blockText: Record<string, string> = {};

  const rows = INVOICE_TEMPLATE_BLOCK_KEYS.map((key) => {
    const legacy = byKey.get(key);
    for (const [field, value] of Object.entries(legacy?.textOverrides ?? {})) {
      blockText[blockTextKey(key, field)] = value;
    }
    const dataBlock: InvoiceDataBlock = { id: key, type: key, backgroundColor: "#ffffff", textColor: "#333333" };
    return invoiceRow(`${key}-row`, [invoiceColumn(`${key}-col`, [dataBlock])]);
  });

  return { canvas: { rows }, blockText };
}
