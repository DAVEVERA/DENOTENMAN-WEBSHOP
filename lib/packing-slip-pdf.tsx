const PAGE_WIDTH_PT = 595;
const GOLD = "#e0b200";
const INK = "#333333";
const MUTED = "#6e675c";

export type PackingSlipItem = {
  productName: string;
  variantLabel: string;
  quantity: number;
};

export type PackingSlipInput = {
  orderId: string;
  createdAt: Date;
  contactName: string;
  shippingStreet: string | null;
  shippingHouseNumber: string | null;
  shippingPostalCode: string | null;
  shippingCity: string | null;
  shippingCountry: string;
  items: PackingSlipItem[];
};

function countryName(country: string): string {
  const normalized = country.trim().toUpperCase();
  if (normalized === "BE") return "België";
  if (normalized === "NL") return "Nederland";
  return country.trim();
}

function shippingAddressLines(input: PackingSlipInput): string[] {
  const street = [input.shippingStreet?.trim(), input.shippingHouseNumber?.trim()].filter(Boolean).join(" ");
  const city = [input.shippingPostalCode?.trim(), input.shippingCity?.trim()].filter(Boolean).join(" ");
  return [input.contactName.trim(), street || null, city || null, countryName(input.shippingCountry)].filter(
    (line): line is string => Boolean(line)
  );
}

export function PackingSlipDocument({ input }: { input: PackingSlipInput }) {
  const totalItems = input.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <html>
      <body style={{ margin: 0, fontFamily: "Helvetica, Arial, sans-serif", color: INK }}>
        <div style={{ width: `${PAGE_WIDTH_PT}pt`, padding: "32pt 56pt", boxSizing: "border-box" }}>
          <div style={{ height: "1.8pt", background: GOLD }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: "10pt" }}>
            <div style={{ fontWeight: 700, fontSize: "24pt" }}>Pakbon</div>
            <div style={{ fontSize: "9pt", color: MUTED }}>
              {new Intl.DateTimeFormat("nl-NL", { day: "2-digit", month: "long", year: "numeric" }).format(input.createdAt)}
            </div>
          </div>
          <div style={{ marginTop: "4pt", fontSize: "9pt", color: MUTED }}>Bestelling {input.orderId.slice(0, 10)}…</div>

          <div style={{ marginTop: "24pt", background: "#f6f3ee", padding: "12pt 16pt" }}>
            <div style={{ fontWeight: 700, fontSize: "9.5pt" }}>Verzendadres</div>
            <div style={{ fontSize: "8.5pt", marginTop: "6pt" }}>
              {shippingAddressLines(input).map((line) => (
                <div key={line}>{line}</div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: "24pt" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9pt" }}>
              <thead>
                <tr style={{ background: INK, color: "#ffffff" }}>
                  <th style={{ textAlign: "left", padding: "8pt" }}>Product</th>
                  <th style={{ textAlign: "right", padding: "8pt" }}>Aantal</th>
                </tr>
              </thead>
              <tbody>
                {input.items.map((item, index) => (
                  <tr key={`${item.productName}-${index}`} style={{ background: index % 2 === 0 ? "#fafaf8" : "transparent" }}>
                    <td style={{ padding: "8pt" }}>
                      <div style={{ fontWeight: 700 }}>{item.productName}</div>
                      {item.variantLabel ? <div style={{ color: MUTED, fontSize: "7.8pt" }}>{item.variantLabel}</div> : null}
                    </td>
                    <td style={{ padding: "8pt", textAlign: "right", fontWeight: 700 }}>{item.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ borderTop: `1.5pt solid ${GOLD}`, marginTop: "8pt", paddingTop: "6pt", display: "flex", justifyContent: "space-between", fontSize: "9.5pt", fontWeight: 700 }}>
              <span>Totaal aantal artikelen</span>
              <span>{totalItems}</span>
            </div>
          </div>

          <div style={{ marginTop: "40pt", display: "flex", justifyContent: "space-between", fontSize: "8.5pt", color: MUTED }}>
            <span>Gecontroleerd door: ______________________</span>
            <span>Datum: ______________________</span>
          </div>
        </div>
      </body>
    </html>
  );
}

export async function renderPackingSlipPdfBase64(input: PackingSlipInput): Promise<string> {
  // Dynamically imported to keep this module's react-dom/server usage out
  // of the RSC module graph, same fix already applied for the invoice PDF
  // pipeline (this fork's Next.js build rejects a static import reachable
  // from a Server Component).
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { renderHtmlToPdfBase64 } = await import("@/lib/invoice-pdf-renderer");
  const html = "<!DOCTYPE html>" + renderToStaticMarkup(<PackingSlipDocument input={input} />);
  return renderHtmlToPdfBase64(html);
}
