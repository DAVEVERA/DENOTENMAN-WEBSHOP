import type { MarketManifestGroup } from "@/lib/market-manifest";

const PAGE_WIDTH_PT = 595;
const GOLD = "#e0b200";
const INK = "#333333";
const MUTED = "#6e675c";

export type MarketManifestInput = {
  generatedAt: Date;
  groups: MarketManifestGroup[];
};

function GroupPage({ group, isLast }: { group: MarketManifestGroup; isLast: boolean }) {
  const totalItems = group.orders.reduce(
    (sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
    0
  );

  return (
    <div
      style={{
        width: `${PAGE_WIDTH_PT}pt`,
        padding: "32pt 56pt",
        boxSizing: "border-box",
        pageBreakAfter: isLast ? "auto" : "always",
      }}
    >
      <div style={{ height: "1.8pt", background: GOLD }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: "10pt" }}>
        <div style={{ fontWeight: 700, fontSize: "22pt" }}>Afhaalmanifest</div>
      </div>
      <div style={{ marginTop: "4pt", fontSize: "12pt", fontWeight: 700 }}>{group.locationLabel}</div>
      <div style={{ marginTop: "2pt", fontSize: "9pt", color: MUTED }}>
        {group.orders.length} bestelling(en) · {totalItems} artikel(en)
      </div>

      <div style={{ marginTop: "20pt" }}>
        {group.orders.map((order, orderIndex) => (
          <div
            key={order.id}
            style={{
              marginTop: orderIndex === 0 ? 0 : "14pt",
              paddingTop: orderIndex === 0 ? 0 : "10pt",
              borderTop: orderIndex === 0 ? undefined : "0.75pt solid #ddd6c8",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11pt" }}>
              <div style={{ fontWeight: 700 }}>{order.contactName}</div>
              <div style={{ color: MUTED, fontSize: "8.5pt" }}>Bestelling {order.id.slice(0, 10)}…</div>
            </div>
            <div style={{ fontSize: "8.5pt", color: MUTED, marginTop: "2pt" }}>
              Telefoon: {order.contactPhone ?? "—"}
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9pt", marginTop: "6pt" }}>
              <tbody>
                {order.items.map((item, index) => (
                  <tr key={`${item.productName}-${index}`}>
                    <td style={{ padding: "2pt 0", width: "10%" }}>{item.quantity}×</td>
                    <td style={{ padding: "2pt 0" }}>
                      {item.productName}
                      {item.variantLabel ? (
                        <span style={{ color: MUTED }}> — {item.variantLabel}</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MarketManifestDocument({ input }: { input: MarketManifestInput }) {
  return (
    <html>
      <body style={{ margin: 0, fontFamily: "Helvetica, Arial, sans-serif", color: INK }}>
        {input.groups.map((group, index) => (
          <GroupPage key={group.locationId} group={group} isLast={index === input.groups.length - 1} />
        ))}
      </body>
    </html>
  );
}

export async function renderMarketManifestPdfBase64(input: MarketManifestInput): Promise<string> {
  // Same dynamic-import fix as the packing slip renderer: keeps
  // react-dom/server out of the RSC module graph, since this module is
  // reachable from a Server Component via the API route.
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { renderHtmlToPdfBase64 } = await import("@/lib/invoice-pdf-renderer");
  const html = "<!DOCTYPE html>" + renderToStaticMarkup(<MarketManifestDocument input={input} />);
  return renderHtmlToPdfBase64(html);
}
