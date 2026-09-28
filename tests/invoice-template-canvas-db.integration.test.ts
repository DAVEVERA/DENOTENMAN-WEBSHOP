import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "../lib/prisma";
import { getPublishedInvoiceCanvas, getOrCreateDraftInvoiceCanvas } from "../lib/invoice-template";
import {
  INVOICE_TEMPLATE_BLOCK_KEYS,
  DEFAULT_INVOICE_TEMPLATE_BLOCKS,
  buildLockedDefaultInvoiceCanvas,
  invoiceCanvasSchema,
} from "../lib/invoice-template-schema";

test("getPublishedInvoiceCanvas with no published template returns the locked default canvas", async () => {
  await prisma.invoiceTemplateBlock.deleteMany({});
  await prisma.invoiceTemplate.deleteMany({});
  const { canvas, blockText } = await getPublishedInvoiceCanvas();
  assert.ok(canvas);
  // Seller and buyer address share one row since the 2026-09-14 design lock,
  // so the fallback has fewer rows than block keys but still every block.
  assert.deepEqual(canvas, buildLockedDefaultInvoiceCanvas());
  const types = canvas.rows.flatMap((row) => row.columns.flatMap((column) => column.blocks.map((block) => block.type)));
  assert.deepEqual([...types].sort(), [...INVOICE_TEMPLATE_BLOCK_KEYS].sort());
  const validation = invoiceCanvasSchema.safeParse(canvas);
  assert.ok(validation.success, `Canvas should be valid: ${validation.error?.message}`);
  assert.deepEqual(blockText, {});
});

test("getOrCreateDraftInvoiceCanvas migrates existing legacy InvoiceTemplateBlock-only draft on first read and is idempotent", async () => {
  await prisma.invoiceTemplateBlock.deleteMany({});
  await prisma.invoiceTemplate.deleteMany({});

  // Create a legacy draft with only blocks (no canvas/blockText)
  const legacyDraft = await prisma.invoiceTemplate.create({
    data: {
      status: "DRAFT",
      blocks: {
        create: INVOICE_TEMPLATE_BLOCK_KEYS.map((key) => ({
          key,
          ...DEFAULT_INVOICE_TEMPLATE_BLOCKS[key],
          textOverrides: undefined,
        })),
      },
    },
    include: { blocks: true },
  });

  // First read should migrate and return canvas
  const first = await getOrCreateDraftInvoiceCanvas();
  assert.equal(first.templateId, legacyDraft.id);
  assert.ok(first.canvas);
  assert.ok(Array.isArray(first.canvas.rows));
  const validation = invoiceCanvasSchema.safeParse(first.canvas);
  assert.ok(validation.success, `Canvas should be valid: ${validation.error?.message}`);

  // Second read should return same result (idempotent)
  const second = await getOrCreateDraftInvoiceCanvas();
  assert.equal(second.templateId, first.templateId);
  assert.deepEqual(second.canvas, first.canvas);
  assert.deepEqual(second.blockText, first.blockText);

  const draftCount = await prisma.invoiceTemplate.count({ where: { status: "DRAFT" } });
  assert.equal(draftCount, 1, "Should only have one draft template");
});

test("getPublishedInvoiceCanvas reflects a canvas written directly via prisma.invoiceTemplate.update", async () => {
  await prisma.invoiceTemplateBlock.deleteMany({});
  await prisma.invoiceTemplate.deleteMany({});

  // Create a published template with canvas data
  const customCanvas = {
    rows: [
      {
        id: "custom-row-1",
        backgroundColor: "#f0f0f0",
        padding: 10,
        columns: [
          {
            id: "custom-col-1",
            widthFraction: 1,
            backgroundColor: "#ffffff",
            padding: 5,
            blocks: [
              {
                id: "header",
                type: "header",
                backgroundColor: "#ffffff",
                textColor: "#333333",
              },
            ],
          },
        ],
      },
    ],
  };

  const customBlockText = { "header:title": "Custom Title" };

  const published = await prisma.invoiceTemplate.create({
    data: {
      status: "PUBLISHED",
      canvas: customCanvas,
      blockText: customBlockText,
    },
    include: { blocks: true },
  });

  // Read should return the custom canvas
  const result = await getPublishedInvoiceCanvas();
  assert.deepEqual(result.canvas, customCanvas);
  assert.deepEqual(result.blockText, customBlockText);
});
