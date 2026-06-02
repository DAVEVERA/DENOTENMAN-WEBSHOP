// Integration target:
// customer registers/logs in -> profile/customer record -> order history access via RLS.
export const accountFlowIntegrationSpec = {
  name: "account-flow",
  covers: ["auth", "customer profile", "order history"],
};
