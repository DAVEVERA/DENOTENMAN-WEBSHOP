import "server-only";

import { prisma } from "@/lib/prisma";
import { getMollieClient } from "@/lib/mollie";
import { BASE_URL } from "@/lib/routes";
import { businessOrderListIsExpired } from "@/lib/business-portal-contract";
import { calculateVat } from "@/lib/business-vat";
import { recordBusinessEvent } from "@/lib/business-portal";
import { Prisma } from "@prisma/client";
import type { BusinessAccount, BusinessOrderListItem } from "@prisma/client";

/**
 * Called from within the Mollie webhook's order-status transaction
 * (lib/orders.ts syncOrderPaymentStatus) once an Order linked to a business
 * order-list is confirmed paid. Idempotent: a retried webhook call for an
 * already-PAID list is a silent no-op.
 */
export async function markBusinessOrderListPaid(
  tx: Prisma.TransactionClient,
  businessOrderListId: string
): Promise<void> {
  const claimed = await tx.businessOrderList.updateMany({
    where: { id: businessOrderListId, status: { not: "PAID" } },
    data: { status: "PAID" },
  });
  if (claimed.count === 0) return;
  const orderList = await tx.businessOrderList.findUniqueOrThrow({ where: { id: businessOrderListId } });
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
      error: "NOT_FOUND" | "ORDER_LIST_EXPIRED" | "ORDER_LIST_NOT_PAYABLE" | "ALREADY_PAID" | "PAYMENT_CREATE_FAILED";
    };

function businessOrderItemData(item: BusinessOrderListItem) {
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
 * Creates (or resumes) the Mollie payment for a business order-list checkout.
 * A list may only ever have one linked Order (unique businessOrderListId), so
 * a retry after a cancelled/expired payment reuses that same Order row and
 * re-snapshots the current line items rather than creating a second one.
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
  if (orderList.status === "PAID") return { ok: false, error: "ALREADY_PAID" };
  if (orderList.status !== "SENT") return { ok: false, error: "ORDER_LIST_NOT_PAYABLE" };

  const account = orderList.businessAccount;
  const shadowUser = await ensureBusinessShadowUser(account);
  const existingOrder = await prisma.order.findUnique({ where: { businessOrderListId: orderListId } });

  if (existingOrder && (existingOrder.status === "PAID" || existingOrder.status === "FULFILLED")) {
    return { ok: false, error: "ALREADY_PAID" };
  }

  if (existingOrder && existingOrder.status === "PENDING" && existingOrder.molliePaymentId) {
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
  const subtotalCents = orderList.totalCents;
  const { totalCents } = calculateVat(subtotalCents, Number(account.vatRatePercent));
  const itemsData = orderList.items.map(businessOrderItemData);

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
      // can both pass the existingOrder check as null; the unique
      // businessOrderListId constraint then rejects the loser here. Rather
      // than surface that as a checkout failure, retry once — the retry
      // will see the winner's Order and reuse its Mollie payment.
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
