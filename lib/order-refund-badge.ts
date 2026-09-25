import { isCommittedRefundStatus } from "@/lib/order-refund-calculation";

export type RefundBadgeState = "NONE" | "PARTIAL" | "FULL";

export type RefundForBadge = {
  amountCents: number;
  status: string;
};

/**
 * Derives the "terugbetaald" list-row indicator straight from OrderRefund
 * rows, without relying on Order.status being REFUNDED — a partial refund
 * (or a full refund whose status hasn't synced yet) still has to show up.
 */
export function getOrderRefundBadgeState(
  totalCents: number,
  refunds: RefundForBadge[]
): RefundBadgeState {
  const refundedCents = refunds
    .filter((refund) => isCommittedRefundStatus(refund.status))
    .reduce((sum, refund) => sum + refund.amountCents, 0);

  if (refundedCents <= 0) return "NONE";
  return refundedCents >= totalCents ? "FULL" : "PARTIAL";
}
