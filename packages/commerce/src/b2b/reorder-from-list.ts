import type { CartItem } from "../cart/calculate-cart";
import type { BusinessOrderList } from "./create-order-list";

export function reorderFromList(list: BusinessOrderList): CartItem[] {
  return list.items.map((item) => ({ ...item }));
}
