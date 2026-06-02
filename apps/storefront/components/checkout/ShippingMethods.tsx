import type { CheckoutState } from "../../lib/checkout";

export function ShippingMethods({ checkout }: { checkout: CheckoutState }) {
  return (
    <>
      <label>
        Verzendmethode
        <select name="shippingMethodId" defaultValue={checkout.shippingMethodId ?? "postnl"}>
          <option value="postnl">PostNL pakket</option>
          <option value="pickup">Afhalen op afspraak</option>
        </select>
      </label>

      <label>
        Bezorgopmerking
        <textarea name="note" placeholder="Optioneel" defaultValue={checkout.shippingNote ?? ""} />
      </label>
    </>
  );
}
