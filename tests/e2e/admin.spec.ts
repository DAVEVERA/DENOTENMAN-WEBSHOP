// E2E target:
// admin login -> protected productbeheer -> hidden test product CRUD -> storefront hidden check.
export const adminE2eSpec = {
  paths: ["/login", "/producten", "/producten/nieuw"],
  assertions: ["login", "product save", "image upload", "hidden product not public"],
};
