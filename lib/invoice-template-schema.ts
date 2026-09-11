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
