export const storefrontRoutes = {
  home: "/",
  shop: "/winkel",
  cart: "/winkelwagen",
  checkout: "/checkout",
  account: "/account",
  business: "/zakelijk",
} as const;

export const adminRoutes = {
  home: "/",
  dashboard: "/dashboard",
  login: "/login",
  products: "/producten",
  orders: "/bestellingen",
  customers: "/klanten",
  settings: "/instellingen",
} as const;

export function productRoute(slug: string) {
  return `${storefrontRoutes.shop}/${slug}`;
}

export function adminProductRoute(id: number | string) {
  return `${adminRoutes.products}/${id}`;
}
