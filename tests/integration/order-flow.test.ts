// Integration target:
// create cart -> validate checkout -> create pending order -> mark paid -> enqueue confirmation.
//
// This intentionally stays as an executable outline until the order write API
// and Mollie webhook are implemented.
export const orderFlowIntegrationSpec = {
  name: "order-flow",
  covers: ["cart totals", "checkout validation", "pending order", "payment confirmation"],
};
