import { Resend } from "resend";
import type { Order, OrderItem } from "@prisma/client";
import { isLocale, type Locale } from "@/lib/i18n";
import { BASE_URL, orderConfirmation } from "@/lib/routes";
import { formatPrice } from "@/lib/format";

let client: Resend | undefined;

// Lazily constructed, and every call site treats a missing/failing send as
// non-fatal — a broken confirmation email must never roll back or block an
// already-successful payment. See sendOrderConfirmationEmail below.
function getResendClient(): Resend | undefined {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return undefined;
  if (!client) {
    client = new Resend(apiKey);
  }
  return client;
}

const fromAddress = process.env.MAIL_FROM_ADDRESS ?? "De Notenman <bestellingen@denotenman.com>";

type OrderCopy = {
  subject: string;
  greeting: (name: string) => string;
  intro: string;
  itemsTitle: string;
  subtotal: string;
  shipping: string;
  shippingFree: string;
  total: string;
  shippingHeading: string;
  orderNumber: string;
  viewOrderCta: string;
};

const copyByLocale: Record<Locale, OrderCopy> = {
  nl: {
    subject: "Bevestiging van je bestelling bij De Notenman",
    greeting: (name) => `Bedankt voor je bestelling, ${name}!`,
    intro: "We hebben je betaling ontvangen. Hieronder vind je de bon.",
    itemsTitle: "Bestelde producten",
    subtotal: "Subtotaal",
    shipping: "Verzendkosten",
    shippingFree: "Gratis",
    total: "Totaal",
    shippingHeading: "Verzendadres",
    orderNumber: "Bestelnummer",
    viewOrderCta: "Bekijk je bestelling",
  },
  en: {
    subject: "Your De Notenman order confirmation",
    greeting: (name) => `Thanks for your order, ${name}!`,
    intro: "We've received your payment. Your receipt is below.",
    itemsTitle: "Ordered products",
    subtotal: "Subtotal",
    shipping: "Shipping",
    shippingFree: "Free",
    total: "Total",
    shippingHeading: "Shipping address",
    orderNumber: "Order number",
    viewOrderCta: "View your order",
  },
  fr: {
    subject: "Confirmation de votre commande De Notenman",
    greeting: (name) => `Merci pour votre commande, ${name} !`,
    intro: "Nous avons bien reçu votre paiement. Voici votre reçu.",
    itemsTitle: "Produits commandés",
    subtotal: "Sous-total",
    shipping: "Frais de port",
    shippingFree: "Gratuit",
    total: "Total",
    shippingHeading: "Adresse de livraison",
    orderNumber: "Numéro de commande",
    viewOrderCta: "Voir votre commande",
  },
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderOrderEmailHtml(
  order: Order,
  items: OrderItem[],
  copy: OrderCopy,
  locale: Locale
): string {
  const orderUrl = `${BASE_URL}${orderConfirmation(locale, order.id)}`;

  const itemRows = items
    .map(
      (item) => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #E4DFD5;color:#333333;">
            ${item.quantity}× ${escapeHtml(item.productName)}
            ${item.variantLabel ? `<span style="color:#6E675C;"> (${escapeHtml(item.variantLabel)})</span>` : ""}
          </td>
          <td style="padding:8px 0;border-bottom:1px solid #E4DFD5;color:#333333;text-align:right;white-space:nowrap;">
            ${formatPrice(item.unitPriceCents * item.quantity, locale)}
          </td>
        </tr>`
    )
    .join("");

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#F6F3EE;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F3EE;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width:560px;background:#FFFFFF;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 8px;">
                <p style="margin:0;color:#E0B200;font-weight:700;letter-spacing:.04em;text-transform:uppercase;font-size:13px;">De Notenman</p>
                <h1 style="margin:12px 0 0;color:#141414;font-size:22px;">${escapeHtml(copy.greeting(order.contactName))}</h1>
                <p style="margin:8px 0 0;color:#6E675C;font-size:14px;line-height:1.5;">${copy.intro}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 0;">
                <p style="margin:0;color:#6E675C;font-size:13px;">${copy.orderNumber}: <span style="font-family:monospace;color:#333333;">${order.id}</span></p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 0;">
                <table role="presentation" width="100%" style="font-size:14px;">
                  <tr>
                    <td style="padding:6px 0;color:#6E675C;font-weight:700;border-bottom:2px solid #141414;">${copy.itemsTitle}</td>
                    <td style="padding:6px 0;border-bottom:2px solid #141414;"></td>
                  </tr>
                  ${itemRows}
                  <tr>
                    <td style="padding-top:10px;color:#6E675C;">${copy.subtotal}</td>
                    <td style="padding-top:10px;text-align:right;color:#333333;">${formatPrice(order.subtotalCents, locale)}</td>
                  </tr>
                  <tr>
                    <td style="color:#6E675C;">${copy.shipping}</td>
                    <td style="text-align:right;color:#333333;">${order.shippingCents === 0 ? copy.shippingFree : formatPrice(order.shippingCents, locale)}</td>
                  </tr>
                  <tr>
                    <td style="padding-top:6px;font-weight:700;color:#141414;">${copy.total}</td>
                    <td style="padding-top:6px;text-align:right;font-weight:700;color:#141414;">${formatPrice(order.totalCents, locale)}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 0;font-size:14px;">
                <p style="margin:0;color:#6E675C;font-weight:700;">${copy.shippingHeading}</p>
                <p style="margin:4px 0 0;color:#333333;line-height:1.5;">
                  ${escapeHtml(order.shippingStreet)} ${escapeHtml(order.shippingHouseNumber)}<br />
                  ${escapeHtml(order.shippingPostalCode)} ${escapeHtml(order.shippingCity)}
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px 32px;">
                <a href="${orderUrl}" style="display:inline-block;background:#E0B200;color:#141414;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:8px;font-size:14px;">${copy.viewOrderCta}</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * Best-effort: caller must not let a failure here affect the order/payment
 * flow, and must not call this more than once per order (see the
 * updateMany-guarded transition in syncOrderPaymentStatus).
 */
export async function sendOrderConfirmationEmail(
  order: Order,
  items: OrderItem[]
): Promise<void> {
  const resend = getResendClient();

  if (!resend) {
    console.warn(
      `RESEND_API_KEY not configured — skipped order confirmation email for order ${order.id}`
    );
    return;
  }

  const locale: Locale = isLocale(order.locale) ? order.locale : "nl";
  const copy = copyByLocale[locale];

  await resend.emails.send({
    from: fromAddress,
    to: order.contactEmail,
    subject: copy.subject,
    html: renderOrderEmailHtml(order, items, copy, locale),
  });
}
