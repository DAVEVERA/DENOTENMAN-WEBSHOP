import assert from "node:assert/strict";
import test from "node:test";
import { validateCheckoutDraft } from "../../packages/commerce/src/checkout/validate-checkout";

test("validateCheckoutDraft accepts a complete draft", () => {
  const draft = validateCheckoutDraft({
    email: "klant@example.com",
    items: [{ productId: 1, name: "Test", quantity: 1, unitPriceCents: 100 }],
    shippingMethodId: "postnl",
    termsAccepted: true,
  });

  assert.equal(draft.email, "klant@example.com");
});
