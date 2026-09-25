import { getOrderRefundBadgeState, type RefundForBadge } from "@/lib/order-refund-badge";

export type OrderRefundBadgeProps = {
  totalCents: number;
  refunds: RefundForBadge[];
};

export function OrderRefundBadge({ totalCents, refunds }: OrderRefundBadgeProps) {
  const state = getOrderRefundBadgeState(totalCents, refunds);

  if (state === "FULL") {
    return (
      <span className="rounded-full border border-red-300 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-800">
        Volledig terugbetaald
      </span>
    );
  }

  if (state === "PARTIAL") {
    return (
      <span className="rounded-full border border-orange-300 bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-800">
        Deels terugbetaald
      </span>
    );
  }

  return null;
}
