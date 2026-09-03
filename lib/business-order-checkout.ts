import "server-only";

import { prisma } from "@/lib/prisma";
import { getMollieClient } from "@/lib/mollie";
import { BASE_URL } from "@/lib/routes";
import { businessOrderListIsExpired, calculateBusinessOrderListTotal } from "@/lib/business-portal-contract";
import { calculateVat } from "@/lib/business-vat";
import { recordBusinessEvent } from "@/lib/business-portal";
import { Prisma } from "@prisma/client";
import type { BusinessAccount, BusinessOrderListItem } from "@prisma/client";

/**
 * Called from within the Mollie webhook's order-status transaction
 * (lib/orders.ts syncOrderPaymentStatus) once an Order linked to a business
 * order-list is confirmed paid. The caller only invokes this on the single
 * transaction that wins the order's PENDING->PAID transition (guarded by
 * its own optimistic-status update), so this never needs its own
 * idempotency check.
 *
 * The order list itself is continuous — it is never "used up" by a
 * payment. Quantities reset to a clean slate for the next ordering round;
 * the completed round remains visible to the customer via the Order row
 * itself (see the orders relation), not via the list's own state.
 */
export async function markBusinessOrderListPaid(
  tx: Prisma.TransactionClient,
  businessOrderListId: string
): Promise<void> {
  const orderList = await tx.businessOrderList.findUniqueOrThrow({ where: { id: businessOrderListId } });
  await tx.businessOrderListItem.updateMany({
    where: { orderListId: businessOrderListId, quantity: { gt: 0 } },
    data: { quantity: 0 },
  });
  await tx.businessOrderList.update({
    where: { id: businessOrderListId },
    data: { totalCents: 0, version: { increment: 1 } },
  });
  await recordBusinessEvent(tx, {
    businessAccountId: orderList.businessAccountId,
    orderListId: businessOrderListId,
    type: "ORDER_LIST_PAID",
    actorType: "SYSTEM",
    actorName: "Mollie",
    summary: `Betaling ontvangen voor "${orderList.title}"`,
  });
}

export type BusinessCheckoutResult =
  | { ok: true; checkoutUrl: string }
  | {
      ok: false;
      error:
        | "NOT_FOUND"
        | "ORDER_LIST_EXPIRED"
        | "ORDER_LIST_NOT_PAYABLE"
        | "EMPTY_ORDER"
        | "PRICE_PENDING"
        | "PAYMENT_CREATE_FAILED";
    };

function businessOrderItemData(item: BusinessOrderListItem & { unitPriceCents: number }) {
  return {
    variantId: item.productVariantId,
    sku: item.sku,
    productName: item.productName,
    variantLabel: item.variantLabel ?? "",
    quantity: item.quantity,
    unitPriceCents: item.unitPriceCents,
  };
}

async function ensureBusinessShadowUser(account: BusinessAccount) {
  if (account.shadowUserId) {
    const existing = await prisma.user.findUnique({ where: { id: account.shadowUserId } });
    if (existing) return existing;
  }
  const normalizedEmail = account.email.trim().toLowerCase();
  const user = await prisma.user.upsert({
    where: { email: normalizedEmail },
    update: {},
    create: { email: normalizedEmail, name: account.contactName, isBusinessShadow: true },
  });
  await prisma.businessAccount.update({ where: { id: account.id }, data: { shadowUserId: user.id } });
  return user;
}

/**
 * Creates (or resumes) the Mollie payment for one checkout round of a
 * continuous business order list. Each round gets its own Order row — past
 * rounds stay in place as order history rather than being reused or
 * overwritten. A partial unique index (Order_pending_business_order_list_unique)
 * guarantees at most one PENDING order per list, so a resumed/abandoned
 * payment reuses that same PENDING Order rather than creating a second one.
 */
export async function createBusinessOrderListCheckout(
  businessAccountId: string,
  orderListId: string,
  retriesLeft = 1
): Promise<BusinessCheckoutResult> {
  const orderList = await prisma.businessOrderList.findFirst({
    where: { id: orderListId, businessAccountId },
    include: { items: { orderBy: { sortOrder: "asc" } }, businessAccount: true },
  });
  if (!orderList) return { ok: false, error: "NOT_FOUND" };
  if (businessOrderListIsExpired(orderList.validUntil)) return { ok: false, error: "ORDER_LIST_EXPIRED" };
  if (orderList.status !== "SENT") return { ok: false, error: "ORDER_LIST_NOT_PAYABLE" };

  const orderableItems = orderList.items.filter((item) => item.quantity > 0);
  if (orderableItems.length === 0) return { ok: false, error: "EMPTY_ORDER" };
  // A line still marked "prijs op aanvraag" has no settled price yet - it
  // must never reach Mollie or an OrderItem (whose unitPriceCents is
  // NOT NULL). The admin resolves this by setting a real price on the line.
  if (orderableItems.some((item) => item.priceOnRequest || item.unitPriceCents === null)) {
    return { ok: false, error: "PRICE_PENDING" };
  }
  const priceResolvedItems = orderableItems as (BusinessOrderListItem & { unitPriceCents: number })[];

  const account = orderList.businessAccount;
  const shadowUser = await ensureBusinessShadowUser(account);
  const existingOrder = await prisma.order.findFirst({
    where: { businessOrderListId: orderListId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });

  if (existingOrder?.molliePaymentId) {
    try {
      const payment = await getMollieClient().payments.get(existingOrder.molliePaymentId);
      const url = payment.getCheckoutUrl();
      if (url) return { ok: true, checkoutUrl: url };
    } catch {
      // Mollie lookup failed; fall through and issue a fresh payment below.
    }
  }

  // orderList.totalCents is the sum of Fedor's line prices, which are always
  // excl. BTW — the customer must actually pay that plus VAT (or the same
  // amount at 0% for a BE reverse-charge account).
  const subtotalCents = calculateBusinessOrderListTotal(priceResolvedItems);
  const { totalCents } = calculateVat(subtotalCents, Number(account.vatRatePercent));
  const itemsData = priceResolvedItems.map(businessOrderItemData);

  let order;
  if (existingOrder) {
    order = await prisma.$transaction(async (tx) => {
      await tx.orderItem.deleteMany({ where: { orderId: existingOrder.id } });
      return tx.order.update({
        where: { id: existingOrder.id },
        data: {
          status: "PENDING",
          subtotalCents,
          totalCents,
          molliePaymentId: null,
          paidAt: null,
          items: { create: itemsData },
        },
      });
    });
  } else {
    try {
      order = await prisma.order.create({
        data: {
          userId: shadowUser.id,
          status: "PENDING",
          isTest: false,
          locale: "nl",
          currency: "EUR",
          subtotalCents,
          totalCents,
          contactName: account.contactName,
          contactEmail: account.email,
          deliveryMethod: "SHIPPING",
          shippingCountry: account.country,
          businessOrderListId: orderListId,
          items: { create: itemsData },
        },
      });
    } catch (error) {
      // Two concurrent checkout clicks (a double-click, or two open tabs)
      // can both pass the "no PENDING order" check as true; the partial
      // unique index then rejects the loser here. Rather than surface that
      // as a checkout failure, retry once — the retry will see the
      // winner's PENDING Order and reuse its Mollie payment.
      const isConcurrentCreate = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
      if (isConcurrentCreate && retriesLeft > 0) {
        return createBusinessOrderListCheckout(businessAccountId, orderListId, retriesLeft - 1);
      }
      throw error;
    }
  }

  const isPubliclyReachable = /^https:\/\//.test(BASE_URL);
  try {
    const payment = await getMollieClient().payments.create({
      amount: { currency: "EUR", value: (totalCents / 100).toFixed(2) },
      description: `Zakelijke bestelling ${account.companyName} - De Notenman`,
      redirectUrl: `${BASE_URL}/nl/zakelijk`,
      ...(isPubliclyReachable ? { webhookUrl: `${BASE_URL}/api/webhooks/mollie` } : {}),
      metadata: { orderId: order.id, businessOrderListId: orderListId },
    });
    const checkoutUrl = payment.getCheckoutUrl();
    if (!checkoutUrl) throw new Error("Mollie returned no checkout URL");

    await prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id: order.id }, data: { molliePaymentId: payment.id } });
      await recordBusinessEvent(tx, {
        businessAccountId,
        orderListId,
        type: "ORDER_LIST_CHECKOUT_STARTED",
        actorType: "CUSTOMER",
        actorName: account.contactName,
        summary: `${account.contactName} is een betaling gestart voor "${orderList.title}"`,
      });
    });
    return { ok: true, checkoutUrl };
  } catch (error) {
    await prisma.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } });
    console.error("Failed to create Mollie payment for business order-list checkout", { orderListId, error });
    return { ok: false, error: "PAYMENT_CREATE_FAILED" };
  }
}
