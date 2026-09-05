import type { OrderStatus } from "@prisma/client";

export type OrderAftersalesTrigger =
  | "ORDER_PAID"
  | "ORDER_FULFILLED"
  | "BUSINESS_ORDER_PAID"
  | "BUSINESS_ORDER_FULFILLED";

export function aftersalesTriggerForOrderTransition(
  previous: OrderStatus,
  next: OrderStatus,
  isTest: boolean,
  isBusinessOrder: boolean
): OrderAftersalesTrigger | null {
  if (isTest || previous === next) return null;
  if (next === "PAID") return isBusinessOrder ? "BUSINESS_ORDER_PAID" : "ORDER_PAID";
  if (next === "FULFILLED") return isBusinessOrder ? "BUSINESS_ORDER_FULFILLED" : "ORDER_FULFILLED";
  return null;
}
