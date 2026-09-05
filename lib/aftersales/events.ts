import type { OrderStatus } from "@prisma/client";

export type OrderAftersalesTrigger = "ORDER_PAID" | "ORDER_FULFILLED";

export function aftersalesTriggerForOrderTransition(
  previous: OrderStatus,
  next: OrderStatus,
  isTest: boolean
): OrderAftersalesTrigger | null {
  if (isTest || previous === next) return null;
  if (next === "PAID") return "ORDER_PAID";
  if (next === "FULFILLED") return "ORDER_FULFILLED";
  return null;
}
