// E2E target:
// product listing loads real Supabase products and product detail shows image,
// price, weights/variants and stock label.
export const productE2eSpec = {
  paths: ["/winkel", "/winkel/[slug]"],
  assertions: ["product grid", "product detail", "variant selector"],
};
