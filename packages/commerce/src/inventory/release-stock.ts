import type { StockItem } from "./check-stock";

export function releaseStock(item: StockItem, quantity: number): StockItem {
  return { ...item, reserved: Math.max(0, (item.reserved ?? 0) - quantity) };
}
