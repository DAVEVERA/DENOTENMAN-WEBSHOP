"use server";

import { redirect } from "next/navigation";
import { validateAddressInput, validateCheckoutInput } from "@denotenman/validation";
import { getCart } from "../lib/cart";
import { getCheckoutState, updateCheckoutState } from "../lib/checkout";
import { createPendingOrderWithOptionalMolliePayment } from "../lib/orders";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function saveCheckoutDetailsAction(formData: FormData) {
  const nameParts = getString(formData, "name").split(" ").filter(Boolean);
  const firstName = nameParts[0] ?? "";
  const lastName = nameParts.slice(1).join(" ") || "-";
  const streetLine = getString(formData, "street");
  const streetParts = streetLine.split(" ").filter(Boolean);
  const houseNumber = streetParts.at(-1) ?? "";
  const street = streetParts.slice(0, -1).join(" ") || streetLine;

  const address = validateAddressInput({
    firstName,
    lastName,
    street,
    houseNumber,
    postalCode: getString(formData, "postalCode"),
    city: getString(formData, "city"),
    country: "NL",
  });

  await updateCheckoutState({
    email: getString(formData, "email"),
    firstName: address.firstName,
    lastName: address.lastName,
    phone: getString(formData, "phone"),
    street: address.street,
    houseNumber: address.houseNumber,
    postalCode: address.postalCode,
    city: address.city,
    country: address.country,
  });

  redirect("/checkout/verzending");
}

export async function saveShippingAction(formData: FormData) {
  await updateCheckoutState({
    shippingMethodId: getString(formData, "shippingMethodId") || "postnl",
    shippingNote: getString(formData, "note"),
  });

  redirect("/checkout/betaling");
}

export async function savePaymentAction(formData: FormData) {
  await updateCheckoutState({
    paymentMethod: "mollie",
    termsAccepted: formData.get("termsAccepted") === "on",
  });

  redirect("/checkout/controleren");
}

export async function prepareOrderDraftAction() {
  const cart = await getCart();
  const checkout = await getCheckoutState();

  validateCheckoutInput({
    email: checkout.email ?? "",
    billingAddress: {
      firstName: checkout.firstName ?? "",
      lastName: checkout.lastName ?? "",
      street: checkout.street ?? "",
      houseNumber: checkout.houseNumber ?? "",
      postalCode: checkout.postalCode ?? "",
      city: checkout.city ?? "",
      country: checkout.country ?? "NL",
    },
    shippingMethodId: checkout.shippingMethodId ?? "",
    paymentMethod: "mollie",
    termsAccepted: checkout.termsAccepted === true,
  });

  if (cart.items.length === 0) throw new Error("Winkelwagen is leeg.");
  const draft = await createPendingOrderWithOptionalMolliePayment(cart, checkout);

  if (draft.checkoutUrl) {
    redirect(draft.checkoutUrl);
  }

  redirect(
    `/checkout/succes?draft=1&mollie=disabled&order=${encodeURIComponent(draft.orderNumber)}`,
  );
}
