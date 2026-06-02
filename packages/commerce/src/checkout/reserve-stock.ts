import type { StockItem } from "../inventory/check-stock";
import { reserveStock } from "../inventory/reserve-stock";

export type StockReservationLine = {
  sku: string;
  quantity: number;
};

export function reserveCheckoutStock(items: StockItem[], lines: StockReservationLine[]) {
  return items.map((item) => {
    const line = lines.find((entry) => entry.sku === item.sku);
    return line ? reserveStock(item, line.quantity) : item;
  });
}
