import type { DeliveryMethod, OrderStatus } from "@prisma/client";

const ADMIN_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  PENDING: ["CANCELLED"],
  PAID: ["FULFILLED"],
  FULFILLED: [],
  CANCELLED: [],
  REFUNDED: [],
};

export function isAllowedAdminOrderTransition(
  previous: OrderStatus,
  next: OrderStatus
): boolean {
  return previous === next || ADMIN_TRANSITIONS[previous].includes(next);
}

export function requiresTrackingForFulfillment(deliveryMethod: DeliveryMethod): boolean {
  return deliveryMethod === "SHIPPING";
}
