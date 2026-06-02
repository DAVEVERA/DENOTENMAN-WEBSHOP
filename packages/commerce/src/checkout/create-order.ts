import { calculateCart, type CartItem } from "../cart/calculate-cart";
import { createOrderNumber } from "../orders/order-number";

export type DraftOrder = {
  orderNumber: string;
  customerEmail: string;
  items: CartItem[];
  amountTotalCents: number;
  status: "pending";
};

export function createDraftOrder(customerEmail: string, items: CartItem[], sequence = 1): DraftOrder {
  const cart = calculateCart(items);
  return {
    orderNumber: createOrderNumber(new Date(), sequence),
    customerEmail,
    items,
    amountTotalCents: cart.totals.totalCents,
    status: "pending",
  };
}
