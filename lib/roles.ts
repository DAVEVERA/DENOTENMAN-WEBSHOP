export const roles = ["OWNER", "ADMIN", "STAFF", "CUSTOMER"] as const;

export type Role = (typeof roles)[number];

export const resources = [
  "products",
  "categories",
  "orders",
  "pages",
  "articles",
  "users",
  "compositions",
  "media",
] as const;

export type Resource = (typeof resources)[number];

export type Action = "read" | "write";

export type PermissionMatrix = Record<Resource, Record<Role, Action[]>>;

export const permissions: PermissionMatrix = {
  products: {
    OWNER: ["read", "write"],
    ADMIN: ["read", "write"],
    STAFF: ["read", "write"],
    CUSTOMER: ["read"],
  },
  categories: {
    OWNER: ["read", "write"],
    ADMIN: ["read", "write"],
    STAFF: ["read", "write"],
    CUSTOMER: ["read"],
  },
  orders: {
    OWNER: ["read", "write"],
    ADMIN: ["read", "write"],
    STAFF: ["read"],
    CUSTOMER: ["read"],
  },
  pages: {
    OWNER: ["read", "write"],
    ADMIN: ["read", "write"],
    STAFF: ["read"],
    CUSTOMER: ["read"],
  },
  articles: {
    OWNER: ["read", "write"],
    ADMIN: ["read", "write"],
    STAFF: ["read", "write"],
    CUSTOMER: ["read"],
  },
  users: {
    OWNER: ["read", "write"],
    ADMIN: ["read", "write"],
    STAFF: ["read"],
    CUSTOMER: [],
  },
  compositions: {
    OWNER: ["read", "write"],
    ADMIN: ["read", "write"],
    STAFF: ["read"],
    CUSTOMER: ["read", "write"],
  },
  media: {
    OWNER: ["read", "write"],
    ADMIN: ["read", "write"],
    STAFF: ["read", "write"],
    CUSTOMER: ["read"],
  },
};

export function can(role: Role, resource: Resource, action: Action): boolean {
  return permissions[resource][role].includes(action);
}
