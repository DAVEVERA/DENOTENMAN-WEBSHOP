export type StockItem = {
  sku: string;
  available: number;
  reserved?: number;
};

export function getAvailableStock(item: StockItem) {
  return Math.max(0, item.available - (item.reserved ?? 0));
}

export function hasStock(item: StockItem, quantity: number) {
  return getAvailableStock(item) >= quantity;
}
