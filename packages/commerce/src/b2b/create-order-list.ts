import type { CartItem } from "../cart/calculate-cart";

export type BusinessOrderList = {
  id: string;
  accountId: string;
  name: string;
  items: CartItem[];
};

export function createBusinessOrderList(accountId: string, name: string, items: CartItem[]): BusinessOrderList {
  if (!accountId.trim() || !name.trim()) throw new Error("Account en naam zijn verplicht.");
  return {
    id: crypto.randomUUID(),
    accountId,
    name,
    items,
  };
}
