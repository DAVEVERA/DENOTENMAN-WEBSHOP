export type OrderLineInput = {
  productId: number;
  name: string;
  quantity: number;
  unitPrice: number;
};

export type OrderInput = {
  customerEmail: string;
  lines: OrderLineInput[];
  amountTotal: number;
};

export function validateOrderInput(input: OrderInput) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.customerEmail)) {
    throw new Error("Klant e-mailadres is ongeldig.");
  }
  if (input.lines.length === 0) throw new Error("Order moet minimaal een regel bevatten.");
  if (!Number.isFinite(input.amountTotal) || input.amountTotal < 0) {
    throw new Error("Ordertotaal is ongeldig.");
  }
  return input;
}
