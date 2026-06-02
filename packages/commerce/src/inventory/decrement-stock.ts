import type { StockItem } from "./check-stock";

export function decrementStock(item: StockItem, quantity: number): StockItem {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error("Aantal is ongeldig.");
  if (item.available < quantity) throw new Error("Onvoldoende voorraad.");
  return {
    ...item,
    available: item.available - quantity,
    reserved: Math.max(0, (item.reserved ?? 0) - quantity),
  };
}
