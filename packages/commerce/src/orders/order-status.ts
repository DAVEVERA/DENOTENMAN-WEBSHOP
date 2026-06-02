export const orderStatuses = [
  "pending",
  "paid",
  "processing",
  "shipped",
  "completed",
  "cancelled",
  "refunded",
] as const;

export type OrderStatus = (typeof orderStatuses)[number];

export function canTransitionOrderStatus(from: OrderStatus, to: OrderStatus) {
  if (from === to) return true;
  if (from === "cancelled" || from === "refunded") return false;
  if (from === "pending") return ["paid", "cancelled"].includes(to);
  if (from === "paid") return ["processing", "cancelled", "refunded"].includes(to);
  if (from === "processing") return ["shipped", "cancelled", "refunded"].includes(to);
  if (from === "shipped") return ["completed", "refunded"].includes(to);
  return false;
}
