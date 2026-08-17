import assert from "node:assert/strict";
import { CheckoutError, validateContact, type CheckoutContactInput } from "../lib/orders";

const baseContact: CheckoutContactInput = {
  name: "Jan Jansen",
  email: "jan@example.com",
  deliveryMethod: "SHIPPING",
  country: "NL",
  street: "Kerkstraat",
  houseNumber: "1",
  postalCode: "5405 AB",
  city: "Uden",
};

function assertThrowsCode(fn: () => void, code: string) {
  assert.throws(fn, (error: unknown) => {
    assert.ok(error instanceof CheckoutError);
    assert.equal(error.code, code);
    return true;
  });
}

// Shipping within NL is valid.
validateContact(baseContact);

// Shipping to BE is valid too — PostNL delivers there.
validateContact({ ...baseContact, country: "BE" });

// Shipping outside NL/BE is rejected.
assertThrowsCode(() => validateContact({ ...baseContact, country: "FR" }), "INVALID_CONTACT");

// Shipping without an address is rejected.
assertThrowsCode(
  () => validateContact({ ...baseContact, street: undefined }),
  "INVALID_CONTACT"
);

// Pickup in NL with a valid location is accepted, no address required.
validateContact({
  name: "Jan Jansen",
  email: "jan@example.com",
  deliveryMethod: "PICKUP",
  country: "NL",
  pickupLocationId: "uden",
});

// Pickup in BE with the BE location is accepted.
validateContact({
  name: "Jan Jansen",
  email: "jan@example.com",
  deliveryMethod: "PICKUP",
  country: "BE",
  pickupLocationId: "antwerpen",
});

// Pickup without a chosen location is rejected.
assertThrowsCode(
  () =>
    validateContact({
      name: "Jan Jansen",
      email: "jan@example.com",
      deliveryMethod: "PICKUP",
      country: "NL",
    }),
  "INVALID_PICKUP_LOCATION"
);

// Pickup location must match the selected country (NL location, BE selected).
assertThrowsCode(
  () =>
    validateContact({
      name: "Jan Jansen",
      email: "jan@example.com",
      deliveryMethod: "PICKUP",
      country: "BE",
      pickupLocationId: "uden",
    }),
  "INVALID_PICKUP_LOCATION"
);

console.log("checkout delivery method tests passed");
