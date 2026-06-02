import type { CartItem } from "./calculate-cart";

export type Cart = {
  id: string;
  items: CartItem[];
  createdAt: string;
  updatedAt: string;
};

export function createCart(id = crypto.randomUUID()): Cart {
  const now = new Date().toISOString();
  return {
    id,
    items: [],
    createdAt: now,
    updatedAt: now,
  };
}
