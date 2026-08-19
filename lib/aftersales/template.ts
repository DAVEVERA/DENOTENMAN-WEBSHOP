import type { Order, OrderItem } from "@prisma/client";
import { isLocale, type Locale } from "@/lib/i18n";
import { formatPrice } from "@/lib/format";
import { BASE_URL, orderConfirmation } from "@/lib/routes";
import { postnlTrackingUrl } from "@/lib/shipping";
import type {
  AftersalesLocaleContent,
  AftersalesTriggerValue,
} from "@/lib/aftersales/schema";

type OrderWithItems = Order & { items: OrderItem[] };

export type RenderedAftersalesEmail = {
  subject: string;
  html: string;
  text: string;
  actionUrl: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name.trim();
}

function actionUrlFor(order: Order, trigger: AftersalesTriggerValue, locale: Locale): string {
  if (
    trigger === "ORDER_FULFILLED" &&
    order.postnlTrackingCode &&
    order.shippingPostalCode
  ) {
    return postnlTrackingUrl(
      order.postnlTrackingCode,
      order.shippingPostalCode,
      order.shippingCountry
    );
  }
  return `${BASE_URL}${orderConfirmation(locale, order.id)}`;
}

function replaceTokens(value: string, values: Record<string, string>): string {
  return value.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_match, token: string) => values[token] ?? "");
}

function bodyHtml(value: string): string {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => `<p style="margin:0 0 14px;color:#4f4a42;font-size:16px;line-height:1.65">${escapeHtml(paragraph).replaceAll("\n", "<br>")}</p>`)
    .join("");
}

export function renderAftersalesEmail(
  order: OrderWithItems,
  trigger: AftersalesTriggerValue,
  content: AftersalesLocaleContent
): RenderedAftersalesEmail {
  const locale: Locale = isLocale(order.locale) ? order.locale : "nl";
  const actionUrl = actionUrlFor(order, trigger, locale);
  const tokens = {
    first_name: firstName(order.contactName),
    customer_name: order.contactName,
    order_number: order.id,
    order_total: formatPrice(order.totalCents, locale),
    tracking_code: order.postnlTrackingCode ?? "",
    order_url: actionUrl,
  };
  const subject = replaceTokens(content.subject, tokens);
  const preview = replaceTokens(content.previewText, tokens);
  const heading = replaceTokens(content.heading, tokens);
  const message = replaceTokens(content.body, tokens);
  const buttonLabel = replaceTokens(content.buttonLabel, tokens);
  const itemRows = order.items.map((item) => `
    <tr>
      <td style="padding:10px 8px 10px 0;border-bottom:1px solid #e4dfd5;color:#333;font-size:14px;line-height:1.45">
        <strong>${item.quantity}&times; ${escapeHtml(item.productName)}</strong><br>
        <span style="color:#6e675c;font-size:13px">${escapeHtml(item.variantLabel)}</span>
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #e4dfd5;color:#333;font-size:14px;text-align:right;white-space:nowrap">
        ${escapeHtml(formatPrice(item.unitPriceCents * item.quantity, locale))}
      </td>
    </tr>`).join("");
  const itemsSection = trigger === "ORDER_PAID" ? `
    <h2 style="margin:24px 0 10px;color:#141414;font-size:18px;line-height:1.35">${locale === "fr" ? "Votre commande" : locale === "en" ? "Your order" : "Je bestelling"}</h2>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse" aria-label="Order items">
      <tbody>${itemRows}</tbody>
      <tfoot><tr><td style="padding-top:12px;color:#141414;font-weight:700">Totaal</td><td style="padding-top:12px;color:#141414;font-weight:700;text-align:right">${escapeHtml(formatPrice(order.totalCents, locale))}</td></tr></tfoot>
    </table>` : "";
  const tracking = trigger === "ORDER_FULFILLED" && order.postnlTrackingCode
    ? `<p style="margin:18px 0 0;color:#333;font-size:14px"><strong>Track &amp; trace:</strong> ${escapeHtml(order.postnlTrackingCode)}</p>`
    : "";

  const html = `<!doctype html>
<html lang="${locale}" dir="ltr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;background:#f6f3ee;font-family:Arial,Helvetica,sans-serif">
  <div lang="${locale}" dir="ltr" style="display:none;max-height:0;overflow:hidden">${escapeHtml(preview)}</div>
  <div lang="${locale}" dir="ltr" style="padding:24px 12px">
    <div style="max-width:600px;margin:0 auto;overflow:hidden;border:1px solid #ded7ca;border-radius:12px;background:#fff">
      <div style="height:5px;background:#e0b200"></div>
      <div style="padding:28px">
        <p style="margin:0;color:#806600;font-size:13px;font-weight:700;letter-spacing:.08em">DE NOTENMAN</p>
        <h1 style="margin:12px 0 10px;color:#141414;font-size:24px;line-height:1.25">${escapeHtml(heading)}</h1>
        ${bodyHtml(message)}
        <div style="margin:18px 0;padding:14px 16px;border:1px solid #ded7ca;border-radius:8px;background:#f6f3ee;color:#333;font-size:14px">
          <strong>Bestelnummer:</strong> ${escapeHtml(order.id)}
        </div>
        ${itemsSection}
        ${tracking}
        <div style="padding-top:26px">
          <a href="${escapeHtml(actionUrl)}" style="display:block;min-height:44px;box-sizing:border-box;padding:14px 20px;border-radius:8px;background:#e0b200;color:#141414;font-size:16px;font-weight:700;text-align:center;text-decoration:none">${escapeHtml(buttonLabel)}</a>
        </div>
      </div>
      <div style="padding:18px 28px 24px;border-top:1px solid #ded7ca;color:#6e675c;font-size:13px;line-height:1.5">Vragen? Beantwoord deze e-mail; we helpen je graag.</div>
    </div>
  </div>
</body>
</html>`;

  const text = [
    heading,
    "",
    message,
    "",
    `Bestelnummer: ${order.id}`,
    ...(trigger === "ORDER_PAID"
      ? [
          "",
          ...order.items.map((item) => `${item.quantity}× ${item.productName} (${item.variantLabel}) — ${formatPrice(item.unitPriceCents * item.quantity, locale)}`),
          `Totaal: ${formatPrice(order.totalCents, locale)}`,
        ]
      : []),
    ...(order.postnlTrackingCode ? [`Track & trace: ${order.postnlTrackingCode}`] : []),
    "",
    `${buttonLabel}: ${actionUrl}`,
    "",
    "Vragen? Beantwoord deze e-mail; we helpen je graag.",
  ].join("\n");

  return { subject, html, text, actionUrl };
}
