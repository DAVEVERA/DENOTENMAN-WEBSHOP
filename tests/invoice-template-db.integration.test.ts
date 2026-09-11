import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "../lib/prisma";
import { getPublishedInvoiceTemplateBlocks, getOrCreateDraftInvoiceTemplate } from "../lib/invoice-template";
import { INVOICE_TEMPLATE_BLOCK_KEYS, DEFAULT_INVOICE_TEMPLATE_BLOCKS } from "../lib/invoice-template-schema";

test("with no published template, defaults are returned for every block", async () => {
  await prisma.invoiceTemplateBlock.deleteMany({});
  await prisma.invoiceTemplate.deleteMany({});
  const blocks = await getPublishedInvoiceTemplateBlocks();
  assert.equal(blocks.length, INVOICE_TEMPLATE_BLOCK_KEYS.length);
  for (const key of INVOICE_TEMPLATE_BLOCK_KEYS) {
    const block = blocks.find((b) => b.key === key);
    assert.deepEqual(
      { x: block?.x, y: block?.y, width: block?.width, height: block?.height },
      DEFAULT_INVOICE_TEMPLATE_BLOCKS[key]
    );
  }
});

test("getOrCreateDraftInvoiceTemplate seeds a draft from defaults exactly once", async () => {
  await prisma.invoiceTemplateBlock.deleteMany({});
  await prisma.invoiceTemplate.deleteMany({});
  const first = await getOrCreateDraftInvoiceTemplate();
  assert.equal(first.blocks.length, INVOICE_TEMPLATE_BLOCK_KEYS.length);
  const second = await getOrCreateDraftInvoiceTemplate();
  assert.equal(second.templateId, first.templateId);
  const draftCount = await prisma.invoiceTemplate.count({ where: { status: "DRAFT" } });
  assert.equal(draftCount, 1);
});
