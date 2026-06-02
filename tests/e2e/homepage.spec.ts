// E2E target:
// homepage loads, primary navigation works, shop CTA reaches /winkel.
export const homepageE2eSpec = {
  path: "/",
  assertions: ["brand visible", "shop navigation visible", "business navigation visible"],
};
