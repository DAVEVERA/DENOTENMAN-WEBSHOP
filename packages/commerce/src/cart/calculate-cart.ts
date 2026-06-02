import { calculateTotals, type CommerceTotals } from "../pricing/calculate-totals";

export type CartItem = {
  productId: number;
  variantId?: string | null;
  name: string;
  quantity: number;
  unitPriceCents: number;
};

export type CalculatedCart = {
  items: CartItem[];
  totals: CommerceTotals;
};

export function calculateCart(items: CartItem[]): CalculatedCart {
  return {
    items,
    totals: calculateTotals({
      lines: items.map((item) => ({
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
      })),
    }),
  };
}
