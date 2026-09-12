import { formatPrice } from "@/lib/format";
import { invoiceRecipientLines, type InvoiceLine, type InvoicePdfInput } from "@/lib/business-invoice-pdf";
import { blockTextKey, type InvoiceDataBlock } from "@/lib/invoice-template-schema";

const GOLD = "#e0b200";

function textFor(blockText: Record<string, string>, blockId: string, field: string, fallback: string): string {
  return blockText[blockTextKey(blockId, field)] ?? fallback;
}

export function renderDataBlock(
  block: InvoiceDataBlock,
  input: InvoicePdfInput,
  blockText: Record<string, string>,
  logoDataUri: string | null
): React.ReactElement {
  const { id, backgroundColor, textColor } = block;
  const muted = "#6e675c";

  switch (block.type) {
    case "header":
      return (
        <div style={{ background: backgroundColor, padding: "0 0 10pt" }}>
          {logoDataUri ? (
            <div style={{ textAlign: "center" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoDataUri} alt="De Notenman" style={{ height: "32pt", maxWidth: "100%" }} />
            </div>
          ) : null}
          <div style={{ marginTop: logoDataUri ? "8pt" : 0, height: "1.8pt", background: GOLD }} />
          <div style={{ marginTop: "10pt", fontWeight: 700, fontSize: "24pt", color: textColor }}>
            {textFor(blockText, id, "title", "Factuur")}
          </div>
        </div>
      );

    case "sellerAddress":
      return (
        <div style={{ background: backgroundColor, padding: "10pt 0" }}>
          <div style={{ fontWeight: 700, fontSize: "9.5pt", color: textColor }}>Van</div>
          <div style={{ fontSize: "8.5pt", color: textColor, marginTop: "6pt", whiteSpace: "pre-line" }}>De Notenman</div>
        </div>
      );

    case "buyerAddress":
      return (
        <div style={{ background: backgroundColor, padding: "10pt 0" }}>
          <div style={{ fontWeight: 700, fontSize: "9.5pt", color: textColor }}>
            {textFor(blockText, id, "addressLabel", "Factuuradres")}
          </div>
          <div style={{ fontSize: "8.5pt", color: textColor, marginTop: "6pt" }}>
            {invoiceRecipientLines(input).map((line) => (
              <div key={line}>{line}</div>
            ))}
          </div>
        </div>
      );

    case "metadata":
      return (
        <div style={{ background: backgroundColor, display: "flex", alignItems: "center", padding: "10pt 16pt" }}>
          <div style={{ marginRight: "40pt" }}>
            <div style={{ fontSize: "7.5pt", color: muted }}>Factuurnummer</div>
            <div style={{ fontSize: "10.5pt", fontWeight: 700, color: textColor }}>{input.invoiceNumber}</div>
          </div>
          <div style={{ marginRight: "40pt" }}>
            <div style={{ fontSize: "7.5pt", color: muted }}>Factuurdatum</div>
            <div style={{ fontSize: "10.5pt", fontWeight: 700, color: textColor }}>
              {new Intl.DateTimeFormat("nl-NL", { day: "2-digit", month: "long", year: "numeric" }).format(input.createdAt)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "7.5pt", color: muted }}>Status</div>
            <div style={{ fontSize: "10.5pt", fontWeight: 700, color: "#337a3b" }}>BETAALD</div>
          </div>
        </div>
      );

    case "itemsTable":
      return (
        <div style={{ background: backgroundColor, padding: "10pt 0" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "8.5pt" }}>
            <thead>
              <tr style={{ background: "#333333", color: "#ffffff" }}>
                <th style={{ textAlign: "left", padding: "8pt" }}>{textFor(blockText, id, "columnDescription", "Omschrijving")}</th>
                <th style={{ textAlign: "left", padding: "8pt" }}>{textFor(blockText, id, "columnQuantity", "Aantal")}</th>
                <th style={{ textAlign: "right", padding: "8pt" }}>{textFor(blockText, id, "columnUnitPrice", "Prijs per stuk")}</th>
                <th style={{ textAlign: "right", padding: "8pt" }}>{textFor(blockText, id, "columnAmount", "Bedrag")}</th>
              </tr>
            </thead>
            <tbody>
              {input.items.map((item: InvoiceLine, index: number) => (
                <tr key={`${item.productName}-${index}`} style={{ background: index % 2 === 0 ? "#fafaf8" : "transparent" }}>
                  <td style={{ padding: "8pt", color: textColor }}>
                    <div style={{ fontWeight: 700 }}>{item.productName}</div>
                    {item.variantLabel ? <div style={{ color: muted, fontSize: "7.2pt" }}>{item.variantLabel}</div> : null}
                  </td>
                  <td style={{ padding: "8pt", color: textColor }}>{item.quantity}</td>
                  <td style={{ padding: "8pt", textAlign: "right", color: textColor }}>{formatPrice(item.unitPriceCents, "nl")}</td>
                  <td style={{ padding: "8pt", textAlign: "right", fontWeight: 700, color: textColor }}>
                    {formatPrice(item.unitPriceCents * item.quantity, "nl")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case "totals": {
      const vatLabel = input.vatRatePercent === 0 ? "BTW verlegd (0%)" : `BTW (${input.vatRatePercent}%)`;
      return (
        <div style={{ background: backgroundColor, padding: "10pt 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9pt", color: muted }}>
            <span>Subtotaal excl. BTW</span>
            <span>{formatPrice(input.subtotalCents, "nl")}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9pt", color: muted, marginTop: "4pt" }}>
            <span>{vatLabel}</span>
            <span>{formatPrice(input.vatAmountCents, "nl")}</span>
          </div>
          <div style={{ borderTop: `1.5pt solid ${GOLD}`, marginTop: "8pt", paddingTop: "6pt", display: "flex", justifyContent: "space-between", fontSize: "10.5pt", fontWeight: 700, color: textColor }}>
            <span>Totaal</span>
            <span>{formatPrice(input.totalCents, "nl")}</span>
          </div>
          {input.vatNote ? <div style={{ fontSize: "7.5pt", color: muted, marginTop: "8pt" }}>{input.vatNote}</div> : null}
        </div>
      );
    }

    case "footer":
      return (
        <div style={{ background: backgroundColor, borderTop: "0.6pt solid #ddd6c8", paddingTop: "6pt", display: "flex", justifyContent: "space-between", fontSize: "7.8pt", color: muted }}>
          <span style={{ fontWeight: 700, color: textColor }}>{textFor(blockText, id, "thankYouLine", "Bedankt voor uw bestelling bij De Notenman.")}</span>
        </div>
      );
  }
}
