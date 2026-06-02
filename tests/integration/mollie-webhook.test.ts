// Integration target:
// receive Mollie webhook -> fetch payment server-side -> map status -> update order idempotently.
export const mollieWebhookIntegrationSpec = {
  name: "mollie-webhook",
  requires: ["MOLLIE_API_KEY", "MOLLIE_WEBHOOK_SECRET"],
};
