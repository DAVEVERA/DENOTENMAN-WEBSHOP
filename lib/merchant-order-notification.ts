import "server-only";
import { createElement } from "react";
import { render } from "react-email";
import { EmailDeliveryKind, type OrderStatus } from "@prisma/client";
import { NewOrderNotificationEmail } from "@/emails/NewOrderNotificationEmail";
import { formatPrice } from "@/lib/format";
import { LEGAL_IDENTITY } from "@/lib/legal";
import { prisma } from "@/lib/prisma";
import { BASE_URL } from "@/lib/routes";
import {
  deliverTransactionalEmail,
  retryTransactionalEmail,
  type TransactionalEmailResult,
} from "@/lib/transactional-email";

const RECIPIENT_NAME = "Fedor";

export function merchantOrderNotificationRecipient(): string {
  return process.env.ORDER_NOTIFICATION_EMAIL?.trim() || LEGAL_IDENTITY.email;
}

export function isMerchantNewOrderNotifiable(input: {
  status: OrderStatus;
  isTest: boolean;
}): boolean {
  return !input.isTest && (input.status === "PAID" || input.status === "FULFILLED");
}

function acceptedOrPending(result: TransactionalEmailResult): boolean {
  if (result.status === "accepted" || result.status === "pending") return true;
  return result.status === "duplicate" && result.deliveryStatus !== "FAILED";
}

export async function sendMerchantNewOrderNotification(orderId: string): Promise<void> {
  const idempotencyKey = `merchant-new-order-${orderId}`;
  const existing = await prisma.emailDeliveryLog.findUnique({ where: { idempotencyKey } });
  if (existing) {
    const result = existing.status === "FAILED"
      ? await retryTransactionalEmail(existing.id)
      : {
          status: existing.status === "PENDING" ? "pending" as const : "duplicate" as const,
          logId: existing.id,
          deliveryStatus: existing.status,
        };
    if (acceptedOrPending(result)) return;
    if (result.status === "failed") {
      throw new Error(`${result.code}: ${result.error}`);
    }
    throw new Error(`Interne bestelmelding is niet geaccepteerd (${result.status})`);
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) throw new Error(`Bestelling ${orderId} bestaat niet`);
  if (!isMerchantNewOrderNotifiable(order)) return;

  const adminUrl = `${BASE_URL}/admin/bestellingen/${order.id}`;
  const orderDate = new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Amsterdam",
  }).format(order.paidAt ?? order.createdAt);
  const items = order.items.map((item) => ({
    name: `${item.productName} (${item.variantLabel})`,
    quantity: item.quantity,
    lineTotal: formatPrice(item.unitPriceCents * item.quantity, "nl"),
  }));
  const delivery = order.deliveryMethod === "PICKUP"
    ? "Afhalen op de markt"
    : `${order.shippingStreet} ${order.shippingHouseNumber}, ${order.shippingPostalCode} ${order.shippingCity}`;
  const total = formatPrice(order.totalCents, "nl");
  const subject = `Nieuwe bestelling ${order.id} geplaatst — De Notenman`;
  const preview = `${order.contactName} · ${total} · betaling bevestigd`;
  const html = await render(createElement(NewOrderNotificationEmail, {
    preview,
    orderNumber: order.id,
    orderDate,
    customerName: order.contactName,
    customerEmail: order.contactEmail,
    delivery,
    items,
    total,
    adminUrl,
  }));
  const text = [
    "Nieuwe bestelling geplaatst",
    "",
    "De betaling is bevestigd. Dit is de enige interne e-mail voor deze bestelling.",
    "",
    `Bestelnummer: ${order.id}`,
    `Besteld op: ${orderDate}`,
    `Klant: ${order.contactName}`,
    `E-mail: ${order.contactEmail}`,
    `Levering: ${delivery}`,
    "",
    "Bestelde producten",
    ...items.map((item) => `${item.quantity}× ${item.name} — ${item.lineTotal}`),
    "",
    `Totaal: ${total}`,
    `Open bestelling in admin: ${adminUrl}`,
    "",
    "Latere betaal-, verzend- of statuswijzigingen sturen geen extra interne e-mail.",
  ].join("\n");

  const result = await deliverTransactionalEmail({
    idempotencyKey,
    kind: EmailDeliveryKind.NEW_ORDER_NOTIFICATION,
    recipientEmail: merchantOrderNotificationRecipient(),
    recipientName: RECIPIENT_NAME,
    orderId: order.id,
    trigger: "ORDER_PAID",
    subject,
    html,
    text,
  });
  if (acceptedOrPending(result)) return;
  if (result.status === "failed") {
    throw new Error(`${result.code}: ${result.error}`);
  }
  throw new Error(`Interne bestelmelding is niet geaccepteerd (${result.status})`);
}
