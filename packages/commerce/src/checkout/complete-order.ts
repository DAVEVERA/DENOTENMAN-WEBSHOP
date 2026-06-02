import type { DraftOrder } from "./create-order";

export type CompletedOrder = Omit<DraftOrder, "status"> & {
  status: "paid";
  paymentId: string;
  paidAt: string;
};

export function completeOrder(order: DraftOrder, paymentId: string, paidAt = new Date()): CompletedOrder {
  if (!paymentId.trim()) throw new Error("Payment-id ontbreekt.");
  return {
    ...order,
    status: "paid",
    paymentId,
    paidAt: paidAt.toISOString(),
  };
}
