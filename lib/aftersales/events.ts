import type { OrderStatus } from "@prisma/client";

/**
 * Triggers that hang off an Order and therefore queue through the durable
 * outbox. REVIEW_REQUEST belongs here because it needs the same order context,
 * logging and retries — but `aftersalesTriggerForOrderTransition` never returns
 * it: only the manual admin action dispatches a review request.
 */
export type OrderAftersalesTrigger =
  | "ORDER_PAID"
  | "ORDER_FULFILLED"
  | "BUSINESS_ORDER_PAID"
  | "BUSINESS_ORDER_FULFILLED"
  | "REVIEW_REQUEST";

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
