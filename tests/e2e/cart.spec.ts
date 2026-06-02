// E2E target:
// add product to cart, update quantity, remove item, verify totals.
export const cartE2eSpec = {
  paths: ["/winkel/[slug]", "/winkelwagen"],
  assertions: ["add to cart", "quantity update", "totals"],
};
