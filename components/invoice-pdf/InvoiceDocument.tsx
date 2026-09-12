import type { InvoicePdfInput } from "@/lib/business-invoice-pdf";
import { renderDataBlock } from "@/lib/invoice-template-canvas-renderer";
import { renderFreeBlock, type InvoiceFreeBlock } from "@/lib/invoice-template-canvas-renderer";
import type { InvoiceCanvas, InvoiceDataBlock, InvoiceDataBlockType } from "@/lib/invoice-template-schema";

const PAGE_WIDTH_PT = 595;
const REQUIRED_DATA_BLOCK_TYPES: InvoiceDataBlockType[] = ["itemsTable", "totals"];

function isDataBlock(block: { type: string }): block is InvoiceDataBlock {
  return ["header", "sellerAddress", "buyerAddress", "metadata", "itemsTable", "totals", "footer"].includes(block.type);
}

export function InvoiceDocument({
  input,
  canvas,
  blockText,
  logoDataUri = null,
}: {
  input: InvoicePdfInput;
  canvas: InvoiceCanvas;
  blockText: Record<string, string>;
  logoDataUri?: string | null;
}) {
  const renderedDataBlockTypes = new Set<InvoiceDataBlockType>();

  const rows = canvas.rows.map((row) => (
    <div key={row.id} style={{ background: row.backgroundColor, padding: `${row.padding}pt` }}>
      <div style={{ display: "flex" }}>
        {row.columns.map((column) => (
          <div key={column.id} style={{ flex: column.widthFraction, background: column.backgroundColor, padding: `${column.padding}pt` }}>
            {column.blocks.map((block) => {
              if (isDataBlock(block)) {
                renderedDataBlockTypes.add(block.type);
                return <div key={block.id}>{renderDataBlock(block, input, blockText, logoDataUri)}</div>;
              }
              return <div key={block.id}>{renderFreeBlock(block as InvoiceFreeBlock, blockText)}</div>;
            })}
          </div>
        ))}
      </div>
    </div>
  ));

  // Safety net: a paid order's invoice must never lose its line items or
  // totals because a template edit removed those blocks from the canvas.
  const missingRequiredBlocks = REQUIRED_DATA_BLOCK_TYPES.filter((type) => !renderedDataBlockTypes.has(type)).map((type) => (
    <div key={`fallback-${type}`}>{renderDataBlock({ id: type, type, backgroundColor: "#ffffff", textColor: "#333333" }, input, blockText, null)}</div>
  ));

  return (
    <html>
      <body style={{ margin: 0, fontFamily: "Helvetica, Arial, sans-serif", color: "#333333" }}>
        <div style={{ width: `${PAGE_WIDTH_PT}pt`, padding: "32pt 56pt" }}>
          {rows}
          {missingRequiredBlocks}
        </div>
      </body>
    </html>
  );
}
