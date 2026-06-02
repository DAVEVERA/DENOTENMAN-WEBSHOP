import type { CheckoutState } from "../../lib/checkout";

export function CustomerForm({ checkout }: { checkout: CheckoutState }) {
  const name = [checkout.firstName, checkout.lastName]
    .filter((part) => part && part !== "-")
    .join(" ");

  return (
    <>
      <label>
        Naam
        <input type="text" name="name" autoComplete="name" defaultValue={name} required />
      </label>

      <label>
        E-mailadres
        <input type="email" name="email" autoComplete="email" defaultValue={checkout.email ?? ""} required />
      </label>

      <label>
        Telefoonnummer
        <input type="text" name="phone" autoComplete="tel" defaultValue={checkout.phone ?? ""} />
      </label>
    </>
  );
}
