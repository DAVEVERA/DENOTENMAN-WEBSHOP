import "server-only";

import { prisma } from "@/lib/prisma";
import { recordBusinessEvent, sendBusinessPriceRequestedEmail } from "@/lib/business-portal";

export type RequestItemPriceResult =
  | { ok: true; requestedAt: string }
  | { ok: false; error: "NOT_FOUND" | "NOT_ON_REQUEST" | "ALREADY_REQUESTED" };

/**
 * The only price-related action a business customer can take: ask Fedor to
 * fill in a real price for a line still marked "prijs op aanvraag". Emails
 * the admin once per outstanding request — priceRequestedAt blocks a
 * second click from sending a duplicate, and is cleared automatically once
 * an admin resolves the line with a real price (see the admin order-list
 * items route).
 */
export async function requestBusinessOrderListItemPrice(
  businessAccountId: string,
  orderListId: string,
  itemId: string
): Promise<RequestItemPriceResult> {
  const item = await prisma.businessOrderListItem.findFirst({
    where: { id: itemId, orderListId, orderList: { businessAccountId } },
    include: { orderList: { include: { businessAccount: true } } },
  });
  if (!item) return { ok: false, error: "NOT_FOUND" };
  if (!item.priceOnRequest) return { ok: false, error: "NOT_ON_REQUEST" };
  if (item.priceRequestedAt) return { ok: false, error: "ALREADY_REQUESTED" };

  const requestedAt = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.businessOrderListItem.update({ where: { id: itemId }, data: { priceRequestedAt: requestedAt } });
    await recordBusinessEvent(tx, {
      businessAccountId,
      orderListId,
      type: "ORDER_LIST_PRICE_REQUESTED",
      actorType: "CUSTOMER",
      actorName: item.orderList.businessAccount.contactName,
      summary: `${item.orderList.businessAccount.contactName} vroeg een prijs op voor ${item.productName}`,
    });
  });

  try {
    await sendBusinessPriceRequestedEmail({
      itemId,
      requestedAt,
      businessAccountId,
      orderListTitle: item.orderList.title,
      productName: item.productName,
      variantLabel: item.variantLabel,
      quantity: item.quantity,
      account: item.orderList.businessAccount,
    });
  } catch (error) {
    console.error("Failed to send business price-requested email", { itemId, error });
    // The request itself is already saved - a delivery failure here
    // shouldn't hide that from the customer as an outright failure.
  }

  return { ok: true, requestedAt: requestedAt.toISOString() };
}
