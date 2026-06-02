import { hasStock, type StockItem } from "./check-stock";

export function reserveStock(item: StockItem, quantity: number): StockItem {
  if (!hasStock(item, quantity)) throw new Error("Onvoldoende voorraad.");
  return { ...item, reserved: (item.reserved ?? 0) + quantity };
}
