import { createElement } from "react";
import { render } from "react-email";
import { Resend } from "resend";
import type { Order, OrderItem } from "@prisma/client";
import { OrderConfirmationEmail } from "@/emails/OrderConfirmationEmail";
import { isLocale, type Locale } from "@/lib/i18n";
import { BASE_URL, orderConfirmation } from "@/lib/routes";
import { formatPrice } from "@/lib/format";

let client: Resend | undefined;
const MAX_SEND_ATTEMPTS = 3;

class MailDeliveryError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean
  ) {
    super(message);
    this.name = "MailDeliveryError";
  }
}

function getResendClient(): Resend | undefined {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return undefined;
  if (!client) client = new Resend(apiKey);
  return client;
}

function getFromAddress(): string {
  if (process.env.MAIL_FROM_ADDRESS) return process.env.MAIL_FROM_ADDRESS;

  const name = process.env.MAIL_FROM_NAME ?? "De Notenman";
  const email = process.env.MAIL_FROM_EMAIL ?? "bestellingen@denotenman.com";
  return `${name} <${email}>`;
}

type OrderCopy = {
  subject: (orderNumber: string) => string;
  preview: (orderNumber: string, total: string) => string;
  greeting: (name: string) => string;
  intro: string;
  itemsTitle: string;
  product: string;
  amount: string;
  subtotal: string;
  shipping: string;
  shippingFree: string;
  total: string;
  shippingHeading: string;
  orderNumber: string;
  orderDate: string;
  viewOrderCta: string;
  footer: string;
};

const copyByLocale: Record<Locale, OrderCopy> = {
  nl: {
    subject: (orderNumber) => `Bestelling ${orderNumber} is bevestigd — De Notenman`,
    preview: (orderNumber, total) => `Betaling ontvangen · bestelbon ${orderNumber} · ${total}`,
    greeting: (name) => `Bedankt voor je bestelling, ${name}!`,
    intro: "We hebben je betaling ontvangen. Hieronder vind je de bestelbon.",
    itemsTitle: "Bestelde producten",
    product: "Product",
    amount: "Bedrag",
    subtotal: "Subtotaal",
    shipping: "Verzendkosten",
    shippingFree: "Gratis",
    total: "Totaal",
    shippingHeading: "Verzendadres",
    orderNumber: "Bestelnummer",
    orderDate: "Besteldatum",
    viewOrderCta: "Bekijk je bestelling",
    footer: "Vragen over je bestelling? Beantwoord deze e-mail; we helpen je graag.",
  },
  en: {
    subject: (orderNumber) => `Order ${orderNumber} is confirmed — De Notenman`,
    preview: (orderNumber, total) => `Payment received · receipt ${orderNumber} · ${total}`,
    greeting: (name) => `Thanks for your order, ${name}!`,
    intro: "We've received your payment. Your order receipt is below.",
    itemsTitle: "Ordered products",
    product: "Product",
    amount: "Amount",
    subtotal: "Subtotal",
    shipping: "Shipping",
    shippingFree: "Free",
    total: "Total",
    shippingHeading: "Shipping address",
    orderNumber: "Order number",
    orderDate: "Order date",
    viewOrderCta: "View your order",
    footer: "Questions about your order? Reply to this email and we'll be happy to help.",
  },
  fr: {
    subject: (orderNumber) => `Commande ${orderNumber} confirmée — De Notenman`,
    preview: (orderNumber, total) => `Paiement reçu · reçu ${orderNumber} · ${total}`,
    greeting: (name) => `Merci pour votre commande, ${name} !`,
    intro: "Nous avons bien reçu votre paiement. Votre reçu de commande figure ci-dessous.",
    itemsTitle: "Produits commandés",
    product: "Produit",
    amount: "Montant",
    subtotal: "Sous-total",
    shipping: "Frais de port",
    shippingFree: "Gratuit",
    total: "Total",
    shippingHeading: "Adresse de livraison",
    orderNumber: "Numéro de commande",
    orderDate: "Date de commande",
    viewOrderCta: "Voir votre commande",
    footer: "Une question sur votre commande ? Répondez à cet e-mail, nous vous aiderons volontiers.",
  },
};

function countryName(countryCode: string, locale: Locale): string {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(countryCode) ?? countryCode;
  } catch {
    return countryCode;
  }
}

export async function renderOrderConfirmationEmail(
  order: Order,
  items: OrderItem[]
): Promise<{ subject: string; html: string; text: string; orderUrl: string }> {
  const locale: Locale = isLocale(order.locale) ? order.locale : "nl";
  const copy = copyByLocale[locale];
  const orderUrl = `${BASE_URL}${orderConfirmation(locale, order.id)}`;
  const total = formatPrice(order.totalCents, locale);
  const shipping =
    order.shippingCents === 0 ? copy.shippingFree : formatPrice(order.shippingCents, locale);

  const email = createElement(OrderConfirmationEmail, {
    locale,
    preview: copy.preview(order.id, total),
    greeting: copy.greeting(order.contactName),
    intro: copy.intro,
    orderNumberLabel: copy.orderNumber,
    orderNumber: order.id,
    orderDateLabel: copy.orderDate,
    orderDate: new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(order.createdAt),
    itemsTitle: copy.itemsTitle,
    productLabel: copy.product,
    amountLabel: copy.amount,
    items: items.map((item) => ({
      productName: item.productName,
      variantLabel: item.variantLabel,
      quantity: item.quantity,
      lineTotal: formatPrice(item.unitPriceCents * item.quantity, locale),
    })),
    subtotalLabel: copy.subtotal,
    subtotal: formatPrice(order.subtotalCents, locale),
    shippingLabel: copy.shipping,
    shipping,
    totalLabel: copy.total,
    total,
    shippingHeading: copy.shippingHeading,
    shippingAddress: [
      order.contactName,
      `${order.shippingStreet} ${order.shippingHouseNumber}`,
      `${order.shippingPostalCode} ${order.shippingCity}`,
      countryName(order.shippingCountry, locale),
    ],
    viewOrderCta: copy.viewOrderCta,
    orderUrl,
    footer: copy.footer,
  });

  const [html, text] = await Promise.all([
    render(email),
    render(email, { plainText: true }),
  ]);

  return {
    subject: copy.subject(order.id),
    html,
    text,
    orderUrl,
  };
}

/**
 * Best-effort: a mail provider failure must never roll back or block an
 * already-successful payment. The payment transition and Resend idempotency
 * key together prevent duplicate confirmations for the same order.
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

  const { subject, html, text } = await renderOrderConfirmationEmail(order, items);
  const payload = {
    from: getFromAddress(),
    to: order.contactEmail,
    replyTo: process.env.MAIL_REPLY_TO,
    subject,
    html,
    text,
    tags: [
      { name: "type", value: "order_confirmation" },
      { name: "order_id", value: order.id },
    ],
  };

  for (let attempt = 1; attempt <= MAX_SEND_ATTEMPTS; attempt += 1) {
    try {
      const { error } = await resend.emails.send(payload, {
        idempotencyKey: `order-confirmation-${order.id}`,
      });

      if (!error) return;

      const retryable = error.statusCode === 429 || (error.statusCode ?? 0) >= 500;
      throw new MailDeliveryError(
        `Resend rejected order confirmation ${order.id}: ${error.message}`,
        retryable
      );
    } catch (error) {
      const failure =
        error instanceof MailDeliveryError
          ? error
          : new MailDeliveryError(
              error instanceof Error ? error.message : "Unknown email provider error",
              true
            );

      if (!failure.retryable || attempt === MAX_SEND_ATTEMPTS) throw failure;

      const backoffMs = 400 * 2 ** (attempt - 1) + Math.floor(Math.random() * 200);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }
}
