// E2E target:
// customer account login/register and order history. Pending customer auth.
export const accountE2eSpec = {
  paths: ["/account", "/account/inloggen"],
  assertions: ["auth form", "session", "order history"],
};
