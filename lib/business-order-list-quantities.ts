import "server-only";

import { prisma } from "@/lib/prisma";
import { businessOrderListIsExpired, calculateBusinessOrderListTotal } from "@/lib/business-portal-contract";
import { recordBusinessEvent } from "@/lib/business-portal";
import type { BusinessOrderList, BusinessOrderListItem } from "@prisma/client";

export type QuantityUpdate = { itemId: string; quantity: number };

export type UpdateQuantitiesResult =
  | { ok: true; orderList: BusinessOrderList & { items: BusinessOrderListItem[] } }
  | {
      ok: false;
      error:
        | "NOT_FOUND"
        | "NOT_EDITABLE"
        | "ORDER_LIST_EXPIRED"
        | "CHECKOUT_IN_PROGRESS"
        | "VERSION_CONFLICT"
        | "ITEM_MISMATCH";
    };

/**
 * The only write access a business customer has to their order list: they
 * may change how much of each of Fedor's line items they want this round,
 * nothing else (not the product, unit, or price). The payload must name
 * every current item exactly once — a partial update would leave the
 * server unable to tell "customer left this at 0 on purpose" apart from
 * "customer's client is stale and never sent this item".
 */
export async function updateBusinessOrderListQuantities(
  businessAccountId: string,
  orderListId: string,
  expectedVersion: number,
  quantities: readonly QuantityUpdate[]
): Promise<UpdateQuantitiesResult> {
  return prisma.$transaction(async (tx) => {
    const orderList = await tx.businessOrderList.findFirst({
      where: { id: orderListId, businessAccountId },
      include: { items: true, businessAccount: true },
    });
    if (!orderList) return { ok: false, error: "NOT_FOUND" };
    if (orderList.status !== "SENT") return { ok: false, error: "NOT_EDITABLE" };
    if (businessOrderListIsExpired(orderList.validUntil)) return { ok: false, error: "ORDER_LIST_EXPIRED" };
    if (orderList.version !== expectedVersion) return { ok: false, error: "VERSION_CONFLICT" };

    const pendingOrder = await tx.order.findFirst({
      where: { businessOrderListId: orderListId, status: "PENDING" },
      select: { id: true },
    });
    if (pendingOrder) return { ok: false, error: "CHECKOUT_IN_PROGRESS" };

    const itemIds = new Set(orderList.items.map((item) => item.id));
    const quantityByItemId = new Map(quantities.map((entry) => [entry.itemId, entry.quantity]));
    const coversExactly = quantities.length === orderList.items.length
      && [...itemIds].every((itemId) => quantityByItemId.has(itemId));
    if (!coversExactly) return { ok: false, error: "ITEM_MISMATCH" };

    const totalCents = calculateBusinessOrderListTotal(
      orderList.items.map((item) => ({ quantity: quantityByItemId.get(item.id)!, unitPriceCents: item.unitPriceCents }))
    );

    const claimed = await tx.businessOrderList.updateMany({
      where: { id: orderListId, version: expectedVersion },
      data: { totalCents, version: { increment: 1 } },
    });
    if (claimed.count !== 1) return { ok: false, error: "VERSION_CONFLICT" };

    await Promise.all(
      orderList.items.map((item) => {
        const quantity = quantityByItemId.get(item.id)!;
        if (quantity === item.quantity) return Promise.resolve();
        return tx.businessOrderListItem.update({ where: { id: item.id }, data: { quantity } });
      })
    );

    await recordBusinessEvent(tx, {
      businessAccountId,
      orderListId,
      type: "ORDER_LIST_QUANTITIES_CHANGED",
      actorType: "CUSTOMER",
      actorName: orderList.businessAccount.contactName,
      summary: `${orderList.businessAccount.contactName} heeft aantallen aangepast in "${orderList.title}"`,
    });

    const updated = await tx.businessOrderList.findUniqueOrThrow({
      where: { id: orderListId },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });
    return { ok: true, orderList: updated };
  });
}
