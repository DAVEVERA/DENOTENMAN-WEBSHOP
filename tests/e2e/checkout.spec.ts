// E2E target:
// cart -> checkout details -> shipping -> payment redirect.
// Payment provider should be mocked until Mollie sandbox is connected.
export const checkoutE2eSpec = {
  paths: ["/checkout/gegevens", "/checkout/verzending", "/checkout/betaling"],
  assertions: ["validation", "order draft", "payment handoff"],
};
