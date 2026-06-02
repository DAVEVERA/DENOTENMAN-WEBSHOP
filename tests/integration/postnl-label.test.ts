// Integration target:
// admin shipment action -> worker job -> PostNL label -> shipment tracking code.
export const postnlLabelIntegrationSpec = {
  name: "postnl-label",
  requires: ["POSTNL_API_KEY", "POSTNL_CUSTOMER_NUMBER", "POSTNL_CUSTOMER_CODE"],
};
