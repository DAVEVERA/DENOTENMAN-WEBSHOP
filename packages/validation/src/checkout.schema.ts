import type { AddressInput } from "./address.schema";

export type CheckoutInput = {
  email: string;
  billingAddress: AddressInput;
  shippingAddress?: AddressInput;
  shippingMethodId: string;
  paymentMethod: "mollie";
  termsAccepted: boolean;
};

export function validateCheckoutInput(input: CheckoutInput) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    throw new Error("E-mailadres is ongeldig.");
  }
  if (!input.shippingMethodId.trim()) throw new Error("Verzendmethode is verplicht.");
  if (input.paymentMethod !== "mollie") throw new Error("Betaalmethode is ongeldig.");
  if (!input.termsAccepted) throw new Error("Akkoord met voorwaarden is verplicht.");
  return input;
}
