import "server-only";
import type { AdminOrderDetail } from "./orders";
import { formatAdminDate, formatAdminMoney } from "./orders";

function getCheckoutText(state: Record<string, unknown>, key: string) {
  const value = state[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function getInvoiceAddress(order: AdminOrderDetail) {
  return [
    getCheckoutText(order.checkoutState, "street"),
    getCheckoutText(order.checkoutState, "houseNumber"),
    getCheckoutText(order.checkoutState, "postalCode"),
    getCheckoutText(order.checkoutState, "city"),
  ].filter(Boolean);
}

export function getInvoiceNumber(order: AdminOrderDetail) {
  return `F-${order.orderNumber}`;
}

export function getInvoiceLogoUrl() {
  const baseUrl =
    process.env.ADMIN_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "https://www.denotenman.nl";

  return `${baseUrl.replace(/\/+$/g, "")}/Notenman_onlylogo.png`;
}

export function createInvoiceEmailHtml(order: AdminOrderDetail) {
  const address = getInvoiceAddress(order);
  const invoiceNumber = getInvoiceNumber(order);
  const logoUrl = getInvoiceLogoUrl();
  const rows = order.items
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.name)}</td>
          <td align="right">${item.quantity}</td>
          <td align="right">${formatAdminMoney(item.unitPriceCents)}</td>
          <td align="right"><strong>${formatAdminMoney(item.lineTotalCents)}</strong></td>
        </tr>
      `,
    )
    .join("");

  return `
    <!doctype html>
    <html lang="nl">
      <body style="margin:0;background:#f7f3ec;color:#2f4f4f;font-family:Arial,sans-serif;">
        <main style="max-width:760px;margin:0 auto;padding:32px 18px;">
          <section style="background:#fffdf8;border:1px solid rgba(47,79,79,.16);border-radius:12px;overflow:hidden;">
            <header style="display:flex;justify-content:space-between;gap:24px;align-items:flex-start;padding:28px;border-bottom:4px solid #daa520;background:#f7f3ec;">
              <img src="${logoUrl}" alt="De Notenman" style="width:180px;height:auto;display:block;" />
              <div style="text-align:right;">
                <p style="margin:0;color:#7a9a7a;font-weight:700;text-transform:uppercase;">Factuur</p>
                <h1 style="margin:4px 0 0;font-size:28px;line-height:1;">${invoiceNumber}</h1>
                <p style="margin:8px 0 0;">${formatAdminDate(order.createdAt)}</p>
              </div>
            </header>
            <section style="display:grid;grid-template-columns:1fr 1fr;gap:18px;padding:28px;">
              <div>
                <h2 style="margin:0 0 8px;font-size:16px;">Gefactureerd aan</h2>
                <p style="margin:0;font-weight:700;">${escapeHtml(order.customerName ?? "Naam onbekend")}</p>
                <p style="margin:0;">${escapeHtml(order.customerEmail ?? "E-mail onbekend")}</p>
                ${address.length > 0 ? `<p style="margin:8px 0 0;">${escapeHtml(address.join(", "))}</p>` : ""}
              </div>
              <div>
                <h2 style="margin:0 0 8px;font-size:16px;">De Notenman</h2>
                <p style="margin:0;">Ambachtelijke noten, zuidvruchten en natuurvoeding.</p>
                <p style="margin:8px 0 0;">Order: <strong>${escapeHtml(order.orderNumber)}</strong></p>
              </div>
            </section>
            <section style="padding:0 28px 28px;">
              <table style="width:100%;border-collapse:collapse;">
                <thead>
                  <tr style="background:#2f4f4f;color:#f7f3ec;">
                    <th align="left" style="padding:10px;">Product</th>
                    <th align="right" style="padding:10px;">Aantal</th>
                    <th align="right" style="padding:10px;">Prijs</th>
                    <th align="right" style="padding:10px;">Totaal</th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
              <div style="margin-left:auto;margin-top:20px;max-width:280px;">
                ${summaryRow("Subtotaal", formatAdminMoney(order.subtotalCents))}
                ${summaryRow("Verzending", formatAdminMoney(order.shippingCents))}
                ${summaryRow("BTW", formatAdminMoney(order.taxCents))}
                <div style="display:flex;justify-content:space-between;border-top:2px solid #2f4f4f;margin-top:10px;padding-top:10px;font-size:18px;font-weight:800;">
                  <span>Totaal</span>
                  <span>${formatAdminMoney(order.totalCents)}</span>
                </div>
              </div>
            </section>
          </section>
        </main>
      </body>
    </html>
  `;
}

function summaryRow(label: string, value: string) {
  return `<div style="display:flex;justify-content:space-between;gap:18px;padding:5px 0;"><span>${label}</span><strong>${value}</strong></div>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
