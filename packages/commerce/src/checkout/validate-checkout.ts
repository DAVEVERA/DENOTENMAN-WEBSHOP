import type { CartItem } from "../cart/calculate-cart";

export type CheckoutDraft = {
  email: string;
  items: CartItem[];
  shippingMethodId: string;
  termsAccepted: boolean;
};

export function validateCheckoutDraft(input: CheckoutDraft) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) throw new Error("E-mailadres is ongeldig.");
  if (input.items.length === 0) throw new Error("Winkelwagen is leeg.");
  if (!input.shippingMethodId.trim()) throw new Error("Verzendmethode ontbreekt.");
  if (!input.termsAccepted) throw new Error("Voorwaarden moeten geaccepteerd zijn.");
  return input;
}
