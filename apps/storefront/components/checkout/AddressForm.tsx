import type { CheckoutState } from "../../lib/checkout";

export function AddressForm({ checkout }: { checkout: CheckoutState }) {
  const streetLine = [checkout.street, checkout.houseNumber].filter(Boolean).join(" ");

  return (
    <>
      <label>
        Straat en huisnummer
        <input type="text" name="street" autoComplete="street-address" defaultValue={streetLine} required />
      </label>

      <label>
        Postcode
        <input type="text" name="postalCode" autoComplete="postal-code" defaultValue={checkout.postalCode ?? ""} required />
      </label>

      <label>
        Plaats
        <input type="text" name="city" autoComplete="address-level2" defaultValue={checkout.city ?? ""} required />
      </label>
    </>
  );
}
