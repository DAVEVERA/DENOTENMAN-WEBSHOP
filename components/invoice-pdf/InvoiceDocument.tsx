import { formatPrice } from "@/lib/format";
import type { InvoiceLine, InvoicePdfInput } from "@/lib/business-invoice-pdf";
import { invoiceRecipientLines } from "@/lib/business-invoice-pdf";
import type { InvoiceTemplateBlockLayout, InvoiceTemplateBlockKey } from "@/lib/invoice-template-schema";

const PAGE_WIDTH_PT = 595;
const PAGE_HEIGHT_PT = 842;
const GOLD = "#e0b200";
const INK = "#333333";
const MUTED = "#6e675c";

function blockStyle(block: InvoiceTemplateBlockLayout): React.CSSProperties {
  return { position: "absolute", left: `${block.x}pt`, top: `${block.y}pt`, width: `${block.width}pt`, height: `${block.height}pt` };
}

function textOf(block: InvoiceTemplateBlockLayout | undefined, key: string, fallback: string): string {
  return block?.textOverrides?.[key] ?? fallback;
}

function findBlock(blocks: InvoiceTemplateBlockLayout[], key: InvoiceTemplateBlockKey): InvoiceTemplateBlockLayout | undefined {
  return blocks.find((block) => block.key === key);
}

export function InvoiceDocument({ input, blocks }: { input: InvoicePdfInput; blocks: InvoiceTemplateBlockLayout[] }) {
  const header = findBlock(blocks, "header");
  const sellerAddress = findBlock(blocks, "sellerAddress");
  const buyerAddress = findBlock(blocks, "buyerAddress");
  const metadata = findBlock(blocks, "metadata");
  const itemsTable = findBlock(blocks, "itemsTable");
  const totals = findBlock(blocks, "totals");
  const footer = findBlock(blocks, "footer");
  const recipientLines = invoiceRecipientLines(input);
  const vatLabel = input.vatRatePercent === 0 ? "BTW verlegd (0%)" : `BTW (${input.vatRatePercent}%)`;

  return (
    <html>
      <body style={{ margin: 0, fontFamily: "Helvetica, Arial, sans-serif", color: INK }}>
        <div style={{ position: "relative", width: `${PAGE_WIDTH_PT}pt`, height: `${PAGE_HEIGHT_PT}pt` }}>
          {header ? (
            <div style={blockStyle(header)}>
              <div style={{ fontWeight: 700, fontSize: "24pt" }}>{textOf(header, "title", "Factuur")}</div>
              <div style={{ marginTop: "4pt", height: "1.8pt", background: GOLD }} />
            </div>
          ) : null}

          {sellerAddress ? (
            <div style={blockStyle(sellerAddress)}>
              <div style={{ fontWeight: 700, fontSize: "9.5pt" }}>Van</div>
              <div style={{ fontSize: "8.5pt", color: INK, marginTop: "6pt", whiteSpace: "pre-line" }}>
                {"De Notenman"}
              </div>
            </div>
          ) : null}

          {buyerAddress ? (
            <div style={blockStyle(buyerAddress)}>
              <div style={{ fontWeight: 700, fontSize: "9.5pt" }}>{textOf(buyerAddress, "addressLabel", "Factuuradres")}</div>
              <div style={{ fontSize: "8.5pt", color: INK, marginTop: "6pt" }}>
                {recipientLines.map((line) => (
                  <div key={line}>{line}</div>
                ))}
              </div>
            </div>
          ) : null}

          {metadata ? (
            <div style={{ ...blockStyle(metadata), background: "#f6f3ee", display: "flex", alignItems: "center", padding: "0 16pt" }}>
              <div style={{ marginRight: "40pt" }}>
                <div style={{ fontSize: "7.5pt", color: MUTED }}>Factuurnummer</div>
                <div style={{ fontSize: "10.5pt", fontWeight: 700 }}>{input.invoiceNumber}</div>
              </div>
              <div style={{ marginRight: "40pt" }}>
                <div style={{ fontSize: "7.5pt", color: MUTED }}>Factuurdatum</div>
                <div style={{ fontSize: "10.5pt", fontWeight: 700 }}>
                  {new Intl.DateTimeFormat("nl-NL", { day: "2-digit", month: "long", year: "numeric" }).format(input.createdAt)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "7.5pt", color: MUTED }}>Status</div>
                <div style={{ fontSize: "10.5pt", fontWeight: 700, color: "#337a3b" }}>BETAALD</div>
              </div>
            </div>
          ) : null}

          {itemsTable ? (
            <div style={blockStyle(itemsTable)}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "8.5pt" }}>
                <thead>
                  <tr style={{ background: INK, color: "#ffffff" }}>
                    <th style={{ textAlign: "left", padding: "8pt" }}>{textOf(itemsTable, "columnDescription", "Omschrijving")}</th>
                    <th style={{ textAlign: "left", padding: "8pt" }}>{textOf(itemsTable, "columnQuantity", "Aantal")}</th>
                    <th style={{ textAlign: "right", padding: "8pt" }}>{textOf(itemsTable, "columnUnitPrice", "Prijs per stuk")}</th>
                    <th style={{ textAlign: "right", padding: "8pt" }}>{textOf(itemsTable, "columnAmount", "Bedrag")}</th>
                  </tr>
                </thead>
                <tbody>
                  {input.items.map((item: InvoiceLine, index: number) => (
                    <tr key={`${item.productName}-${index}`} style={{ background: index % 2 === 0 ? "#fafaf8" : "transparent" }}>
                      <td style={{ padding: "8pt" }}>
                        <div style={{ fontWeight: 700 }}>{item.productName}</div>
                        {item.variantLabel ? <div style={{ color: MUTED, fontSize: "7.2pt" }}>{item.variantLabel}</div> : null}
                      </td>
                      <td style={{ padding: "8pt" }}>{item.quantity}</td>
                      <td style={{ padding: "8pt", textAlign: "right" }}>{formatPrice(item.unitPriceCents, "nl")}</td>
                      <td style={{ padding: "8pt", textAlign: "right", fontWeight: 700 }}>
                        {formatPrice(item.unitPriceCents * item.quantity, "nl")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {totals ? (
            <div style={blockStyle(totals)}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9pt", color: MUTED }}>
                <span>Subtotaal excl. BTW</span>
                <span>{formatPrice(input.subtotalCents, "nl")}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9pt", color: MUTED, marginTop: "4pt" }}>
                <span>{vatLabel}</span>
                <span>{formatPrice(input.vatAmountCents, "nl")}</span>
              </div>
              <div style={{ borderTop: `1.5pt solid ${GOLD}`, marginTop: "8pt", paddingTop: "6pt", display: "flex", justifyContent: "space-between", fontSize: "10.5pt", fontWeight: 700 }}>
                <span>Totaal</span>
                <span>{formatPrice(input.totalCents, "nl")}</span>
              </div>
              {input.vatNote ? <div style={{ fontSize: "7.5pt", color: MUTED, marginTop: "8pt" }}>{input.vatNote}</div> : null}
            </div>
          ) : null}

          {footer ? (
            <div style={{ ...blockStyle(footer), borderTop: "0.6pt solid #ddd6c8", paddingTop: "6pt", display: "flex", justifyContent: "space-between", fontSize: "7.8pt", color: MUTED }}>
              <span style={{ fontWeight: 700, color: INK }}>{textOf(footer, "thankYouLine", "Bedankt voor uw bestelling bij De Notenman.")}</span>
            </div>
          ) : null}
        </div>
      </body>
    </html>
  );
}
