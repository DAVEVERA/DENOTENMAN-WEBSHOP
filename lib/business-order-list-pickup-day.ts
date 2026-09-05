import "server-only";

import { prisma } from "@/lib/prisma";
import { recordBusinessEvent } from "@/lib/business-portal";
import { isPickupDayAllowedForLocation } from "@/lib/market-schedule";

export type SetPickupDayResult =
  | { ok: true; pickupDay: string | null }
  | { ok: false; error: "NOT_FOUND" | "PICKUP_LOCATION_MISMATCH" };

/**
 * Optional customer preference, not a checkout gate: which day the business
 * customer would like to collect this round's order. Day only (midnight
 * local) - the market-day/location it maps to is derived on read from
 * lib/market-schedule.ts, not stored here.
 */
export async function setBusinessOrderListPickupDay(
  businessAccountId: string,
  orderListId: string,
  pickupDay: Date | null
): Promise<SetPickupDayResult> {
  const orderList = await prisma.businessOrderList.findFirst({
    where: { id: orderListId, businessAccountId },
    include: { businessAccount: { select: { contactName: true, fixedPickupLocationId: true } } },
  });
  if (!orderList) return { ok: false, error: "NOT_FOUND" };
  if (pickupDay && !isPickupDayAllowedForLocation(pickupDay, orderList.businessAccount.fixedPickupLocationId)) {
    return { ok: false, error: "PICKUP_LOCATION_MISMATCH" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.businessOrderList.update({ where: { id: orderListId }, data: { pickupDay } });
    await recordBusinessEvent(tx, {
      businessAccountId,
      orderListId,
      type: "ORDER_LIST_PICKUP_DAY_SET",
      actorType: "CUSTOMER",
      actorName: orderList.businessAccount.contactName,
      summary: pickupDay
        ? `${orderList.businessAccount.contactName} koos ${pickupDay.toLocaleDateString("nl-NL")} als voorkeursdag voor ophalen`
        : `${orderList.businessAccount.contactName} verwijderde de voorkeursdag voor ophalen`,
    });
  });

  return { ok: true, pickupDay: pickupDay ? pickupDay.toISOString() : null };
}
