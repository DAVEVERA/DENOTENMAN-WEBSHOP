import type { AftersalesTrigger, Prisma } from "@prisma/client";

export function aftersalesTestSampleFilters(
  trigger: AftersalesTrigger
): [Prisma.OrderWhereInput, Prisma.OrderWhereInput] {
  const realOrderFilter: Prisma.OrderWhereInput =
    trigger === "ORDER_FULFILLED"
      ? { isTest: false, status: "FULFILLED" }
      : { isTest: false, status: { in: ["PAID", "FULFILLED"] } };

  return [
    realOrderFilter,
    { isTest: true, status: { in: ["PAID", "FULFILLED"] } },
  ];
}
