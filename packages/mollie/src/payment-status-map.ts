export const molliePaymentStatuses = [
  "open",
  "canceled",
  "pending",
  "authorized",
  "expired",
  "failed",
  "paid",
] as const;

export type MolliePaymentStatus = (typeof molliePaymentStatuses)[number];

export type InternalPaymentStatus =
  | "draft"
  | "open"
  | "pending"
  | "authorized"
  | "paid"
  | "failed"
  | "cancelled"
  | "expired";

export function mapMolliePaymentStatus(status: string): InternalPaymentStatus {
  if (status === "paid") return "paid";
  if (status === "authorized") return "authorized";
  if (status === "pending") return "pending";
  if (status === "open") return "open";
  if (status === "canceled") return "cancelled";
  if (status === "expired") return "expired";
  if (status === "failed") return "failed";
  return "pending";
}

export function mapPaymentStatusToOrderStatus(status: InternalPaymentStatus) {
  if (status === "paid" || status === "authorized") return "paid";
  if (status === "failed" || status === "cancelled" || status === "expired") return "cancelled";
  return "pending";
}

export function isTerminalPaymentStatus(status: InternalPaymentStatus) {
  return status === "paid" || status === "failed" || status === "cancelled" || status === "expired";
}

export function shouldUpdatePaymentStatus(
  currentStatus: string | null | undefined,
  nextStatus: InternalPaymentStatus,
) {
  if (!currentStatus || currentStatus === "draft") return true;
  if (currentStatus === nextStatus) return false;

  const normalizedCurrent = mapMolliePaymentStatus(currentStatus);

  if (isTerminalPaymentStatus(normalizedCurrent) && !isTerminalPaymentStatus(nextStatus)) {
    return false;
  }

  return true;
}
