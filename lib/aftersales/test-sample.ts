import type { AftersalesTrigger, Prisma } from "@prisma/client";

const BUSINESS_TRIGGERS: readonly AftersalesTrigger[] = ["BUSINESS_ORDER_PAID", "BUSINESS_ORDER_FULFILLED"];

export function aftersalesTestSampleFilters(
  trigger: AftersalesTrigger
): [Prisma.OrderWhereInput, Prisma.OrderWhereInput] {
  const isBusinessTrigger = BUSINESS_TRIGGERS.includes(trigger);
  const businessScope: Prisma.OrderWhereInput = isBusinessTrigger
    ? { businessOrderListId: { not: null } }
    : { businessOrderListId: null };
  const isFulfilled = trigger === "ORDER_FULFILLED" || trigger === "BUSINESS_ORDER_FULFILLED";

  const realOrderFilter: Prisma.OrderWhereInput = {
    ...businessScope,
    isTest: false,
    status: isFulfilled ? "FULFILLED" : { in: ["PAID", "FULFILLED"] },
  };

  return [
    realOrderFilter,
    { ...businessScope, isTest: true, status: { in: ["PAID", "FULFILLED"] } },
  ];
}
